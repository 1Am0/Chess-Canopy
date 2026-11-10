import { BUNDLE, FRONTIER, LEAF, NODE, type CanopyTree } from "./types";
import { discVisible, type CanopyLayout } from "./layout";
import { toScreen, type View } from "./viewport";

/** `absPly` is the 0-based ply of the move: 0 "e4" -> "1.e4", 1 "c5" -> "1…c5". */
export function moveLabel(absPly: number, san: string): string {
  return absPly % 2 === 0 ? `${absPly / 2 + 1}.${san}` : `${(absPly - 1) / 2 + 1}…${san}`;
}

/** SANs from the root to `i`. A provisional leaf (san "") stops at its parent. */
export function relPath(t: CanopyTree, i: number): string[] {
  const out: string[] = [];
  for (let c = i; c > 0; c = t.parent[c]) if (t.san[c] !== "") out.push(t.san[c]);
  return out.reverse();
}

/**
 * Line from the root to `i` with move numbers, the last `maxMoves` plies, "…" first when truncated:
 * "…5.O-O Be7 6.Re1". A line starting on Black's move reads "5…Be7 6.Re1".
 */
export function lineText(t: CanopyTree, i: number, maxMoves = 8): string {
  const ids: number[] = [];
  for (let c = i; c > 0; c = t.parent[c]) if (t.san[c] !== "") ids.push(c);
  ids.reverse();
  const truncated = ids.length > maxMoves;
  const shown = truncated ? ids.slice(ids.length - maxMoves) : ids;
  const parts: string[] = [];
  shown.forEach((id, k) => {
    const ply = t.rootPly + t.branchDepth[id] - 1;
    if (ply % 2 === 0) parts.push(moveLabel(ply, t.san[id]));
    else parts.push(k === 0 ? moveLabel(ply, t.san[id]) : t.san[id]);
  });
  return (truncated ? "…" : "") + parts.join(" ");
}

export interface PlacedLabel {
  i: number;
  text: string;
  /** Screen coords of the rect's top-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlaceOptions {
  max?: number;
  /** Node ids of the hovered path (root first). Their labels are placed first. */
  hot?: readonly number[];
  /** Place only the hot path (at most `hotMax`), colliding against `reserved`. */
  hotOnly?: boolean;
  hotMax?: number;
  /** Rects that must not be overlapped (static labels while the overlay draws path labels). */
  reserved?: readonly PlacedLabel[];
}

export const LABEL_H = 13;
const INFLATE = 3;

type Rect = { x: number; y: number; w: number; h: number };
const hit = (a: Rect, b: Rect): boolean =>
  a.x - INFLATE < b.x + b.w + INFLATE &&
  a.x + a.w + INFLATE > b.x - INFLATE &&
  a.y - INFLATE < b.y + b.h + INFLATE &&
  a.y + a.h + INFLATE > b.y - INFLATE;

export function labelCap(box: { width: number; height: number }): number {
  return Math.min(60, Math.floor((box.width * box.height) / 9000));
}

/** Screen radius of a disc at zoom k (matches render.ts). */
export function screenRadius(r: number, k: number): number {
  return r * Math.pow(Math.min(k, 3), 0.4);
}

export function placeLabels(
  t: CanopyTree,
  l: CanopyLayout,
  v: View,
  box: { width: number; height: number },
  measure: (s: string) => number,
  o: PlaceOptions = {},
): PlacedLabel[] {
  const hotOnly = o.hotOnly === true;
  const max = hotOnly ? (o.hotMax ?? 12) : (o.max ?? labelCap(box));
  if (max <= 0 || t.n <= 1) return [];
  const rootGames = Math.max(1, t.games[0]);
  const [, rootSy] = toScreen(v, l.rootX, l.rows.y(0));
  const gutterX = 36;
  const reserved: Rect[] = [{ x: 0, y: 0, w: gutterX, h: box.height }];
  // Root row band (marker and trunk head).
  reserved.push({ x: 0, y: rootSy - 9, w: box.width, h: 18 });
  for (const r of o.reserved ?? []) reserved.push(r);

  const candidates: number[] = [];
  const seen = new Set<number>();
  const hot = o.hot ?? [];
  for (const id of hot) {
    if (id > 0 && t.san[id] !== "" && t.kind[id] !== LEAF && t.kind[id] !== BUNDLE && !seen.has(id)) {
      seen.add(id);
      candidates.push(id);
    }
  }
  if (!hotOnly) {
    const nodes: number[] = [];
    for (let i = 1; i < t.n; i++) {
      const k = t.kind[i];
      if ((k === NODE || k === FRONTIER) && t.san[i] !== "" && !seen.has(i)) nodes.push(i);
    }
    const minShare = 0.05 / (v.k * v.k);
    const first = nodes.filter((i) => t.depth[i] === 1 && t.games[i] / rootGames >= 0.03);
    const firstSet = new Set(first);
    const rest = nodes
      .filter((i) => !firstSet.has(i) && t.games[i] / rootGames >= minShare)
      .sort((a, b) => t.games[b] - t.games[a] || a - b);
    first.sort((a, b) => t.games[b] - t.games[a] || a - b);
    candidates.push(...first, ...rest);
  }

  // Visible discs (screen space) in a coarse grid: a label never covers a comparable node's disc.
  const CELL = 32;
  const cols = Math.max(1, Math.ceil(box.width / CELL));
  const grid = new Map<number, number[]>();
  for (let i = 1; i < t.n; i++) {
    if (hotOnly || !discVisible(t, l, i, v.k)) continue;
    const [sx, sy] = toScreen(v, l.x[i], l.y[i]);
    if (sx < -8 || sy < -8 || sx > box.width + 8 || sy > box.height + 8) continue;
    const key = Math.floor(sy / CELL) * cols + Math.floor(Math.max(0, sx) / CELL);
    let b = grid.get(key);
    if (!b) grid.set(key, (b = []));
    b.push(i);
  }
  const coversDisc = (rc: Rect, self: number, strict: boolean): boolean => {
    const c0 = Math.floor(Math.max(0, rc.x - 8) / CELL);
    const c1 = Math.floor((rc.x + rc.w + 8) / CELL);
    const r0 = Math.floor((rc.y - 8) / CELL);
    const r1 = Math.floor((rc.y + rc.h + 8) / CELL);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= Math.min(c1, cols - 1); c++) {
        for (const i of grid.get(r * cols + c) ?? []) {
          // Above a node, halos keep a label legible over a minor dot but it may not hide a
          // comparable node; beside it (on the row, where the dots are) it must clear every dot.
          if (i === self || (!strict && t.games[i] * 3 < t.games[self])) continue;
          const [sx, sy] = toScreen(v, l.x[i], l.y[i]);
          const rr = screenRadius(l.r[i], v.k) + 1;
          const nx = Math.max(rc.x, Math.min(sx, rc.x + rc.w));
          const ny = Math.max(rc.y, Math.min(sy, rc.y + rc.h));
          if ((nx - sx) ** 2 + (ny - sy) ** 2 < rr * rr) return true;
        }
      }
    }
    return false;
  };

  const placed: PlacedLabel[] = [];
  const statics = o.reserved ?? [];
  for (const id of candidates) {
    if (placed.length >= max) break;
    const [sx, sy] = toScreen(v, l.x[id], l.y[id]);
    const rs = screenRadius(l.r[id] || 2.25, v.k);
    const ply = t.rootPly + t.branchDepth[id] - 1;
    const text = moveLabel(ply, t.san[id]);
    const w = measure(text);
    // Same node already placed by the static layer: re-use its rect exactly.
    const same = statics.find((s) => s.i === id);
    if (same) {
      placed.push({ ...same });
      continue;
    }
    const tries: Rect[] = [
      { x: sx - w / 2, y: sy - rs - 6 - 10, w, h: LABEL_H },
      { x: sx + rs + 4, y: sy - LABEL_H / 2, w, h: LABEL_H },
      { x: sx - rs - 4 - w, y: sy - LABEL_H / 2, w, h: LABEL_H },
    ];
    for (let ti = 0; ti < tries.length; ti++) {
      const rc = tries[ti];
      if (rc.x < gutterX + 1 || rc.x + rc.w > box.width - 2 || rc.y < 2 || rc.y + rc.h > box.height - 2) continue;
      if (reserved.some((q) => (q as PlacedLabel).i !== id && hit(rc, q))) continue;
      if (placed.some((q) => hit(rc, q))) continue;
      if (!hotOnly && coversDisc(rc, id, ti > 0)) continue;
      placed.push({ i: id, text, ...rc });
      break;
    }
  }
  return placed;
}
