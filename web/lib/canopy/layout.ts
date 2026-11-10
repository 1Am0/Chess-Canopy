import { BUNDLE, FRONTIER, LEAF, NODE, type CanopyTree } from "./types";
import { makeRowScale, type RowScale } from "./rows";

export interface LayoutBox {
  width: number;
  height: number;
  gutter: number;
  padTop: number;
  padRight: number;
  ground: number;
}

export interface CanopyLayout {
  n: number;
  /** World coords of the node (LEAF/BUNDLE: the tip). */
  x: Float32Array;
  y: Float32Array;
  /** LEAF/BUNDLE: where the stem leaves its parent (= parent x,y). Others: = x,y. */
  bx: Float32Array;
  by: Float32Array;
  /** Node radius in CSS px at k=1 (0 = disc not drawn). */
  r: Float32Array;
  /** Stroke width of the edge into the node, in screen CSS px. */
  w: Float32Array;
  drawn: Uint8Array;
  /**
   * LEAF/BUNDLE tails follow their slot's flare line, so tails never cross in the crown. The tail
   * leaves its parent and joins the line at the knee (kx, ky: one row above the parent); from there
   * a cubic runs to the tip with slopes dx/dy `tk` at the knee and `tt` at the tip.
   */
  kx: Float32Array;
  ky: Float32Array;
  tk: Float32Array;
  tt: Float32Array;
  /** Leaf and haze radius factor (0.65..1): leaves shrink when the crown is crowded. */
  leafScale: number;
  rootX: number;
  groundY: number;
  rows: RowScale;
}

/** Section 5.2 geometry for a region of the given CSS size. */
export function canopyBox(width: number, height: number): LayoutBox {
  return { width, height, gutter: 36, padTop: 16, padRight: 12, ground: 22 };
}

/** Tip padding so discs and haze at the edges stay inside the box. */
const SIDE_INSET = 6;

/** Children ids of `i` in center-out order: most games in the middle, then right, left, right... */
export function centerOut(t: CanopyTree, i: number): number[] {
  const c = t.childCount[i];
  const f = t.firstChild[i];
  if (c === 0 || f < 0) return [];
  const order: number[] = [f];
  for (let j = 1; j < c; j++) {
    if (j % 2 === 1) order.push(f + j);
    else order.unshift(f + j);
  }
  return order;
}

/**
 * Normalised slot x (0..1) of every node before the flare. Each node without children gets one slot
 * (children visited center-out); an inner node sits at the games-weighted mean of its children.
 */
export function slotX(t: CanopyTree): Float64Array {
  const n = t.n;
  const xs = new Float64Array(n);
  const slotOf = new Float64Array(n).fill(-1);
  let slots = 0;
  // Iterative DFS in center-out order assigning slots to childless nodes.
  const stack: number[] = [0];
  while (stack.length) {
    const i = stack.pop() as number;
    const kids = centerOut(t, i);
    if (kids.length === 0) {
      slotOf[i] = slots++;
    } else {
      for (let j = kids.length - 1; j >= 0; j--) stack.push(kids[j]);
    }
  }
  const span = Math.max(1, slots - 1);
  // BFS order: parents precede children, so a reverse sweep is bottom-up.
  for (let i = n - 1; i >= 0; i--) {
    const c = t.childCount[i];
    if (c === 0 || t.firstChild[i] < 0) {
      xs[i] = slots <= 1 ? 0.5 : slotOf[i] / span;
      continue;
    }
    let gs = 0;
    let acc = 0;
    const f = t.firstChild[i];
    for (let j = 0; j < c; j++) {
      const w = Math.max(1, t.games[f + j]);
      gs += w;
      acc += w * xs[f + j];
    }
    xs[i] = acc / gs;
  }
  return xs;
}

/** Flare (share of the full width) at height fraction f (0 = first row base, 1 = top row). */
export const FLARE = { base: 0.3, exp: 0.55 } as const;
export function flareAt(f: number): number {
  const c = Math.min(1, Math.max(0, f));
  return FLARE.base + (1 - FLARE.base) * Math.pow(c, FLARE.exp);
}
/** d flare / d f (finite at f = 0 by flooring f). */
function flareSlope(f: number): number {
  const c = Math.min(1, Math.max(1e-3, f));
  return (1 - FLARE.base) * FLARE.exp * Math.pow(c, FLARE.exp - 1);
}

export function layoutCanopy(t: CanopyTree, box: LayoutBox): CanopyLayout {
  const n = t.n;
  const groundY = box.height - box.ground;
  const trunk = Math.min(36, Math.max(14, box.height * 0.08));
  const bottom = groundY - trunk;
  const top = Math.min(box.padTop, bottom - 1);
  const rows = makeRowScale(t.depthCap, top, bottom);
  const x0 = box.gutter + SIDE_INSET;
  const x1 = Math.max(x0, box.width - box.padRight - SIDE_INSET);
  const cx = (x0 + x1) / 2;
  const xs = slotX(t);
  const rootGames = Math.max(1, t.games[0]);

  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const bx = new Float32Array(n);
  const by = new Float32Array(n);
  const r = new Float32Array(n);
  const w = new Float32Array(n);
  const drawn = new Uint8Array(n);
  const kx = new Float32Array(n);
  const ky = new Float32Array(n);
  const tk = new Float32Array(n);
  const tt = new Float32Array(n);

  const span = bottom - top || 1;
  const fOf = (yy: number) => (bottom - yy) / span;
  // x on the flare line of slot position s (0..1) at height yy, and its slope dx/dy.
  const lineX = (s: number, yy: number) => cx + (x0 + (x1 - x0) * s - cx) * flareAt(fOf(yy));
  const lineSlope = (s: number, yy: number) => -((x0 + (x1 - x0) * s - cx) * flareSlope(fOf(yy))) / span;
  for (let i = 0; i < n; i++) {
    const yy = rows.y(t.depth[i]);
    const xx = i === 0 ? cx : lineX(xs[i], yy);
    x[i] = xx;
    y[i] = yy;
    bx[i] = xx;
    by[i] = yy;
    kx[i] = xx;
    ky[i] = yy;
  }

  // Flat branches: only mildly thicker for popular moves. Every inner node gets a disc radius; the
  // renderer decides from the zoom which ones are big enough to show (see discVisible).
  w[0] = 2.5;
  for (let i = 1; i < n; i++) {
    const p = t.parent[i];
    bx[i] = x[p];
    by[i] = y[p];
    const kind = t.kind[i];
    const s = Math.min(1, t.games[i] / rootGames);
    if (kind === LEAF || kind === BUNDLE) {
      const kd = Math.min(t.depth[i], t.depth[p] + 1);
      const yk = rows.y(kd);
      kx[i] = lineX(xs[i], yk);
      ky[i] = yk;
      tk[i] = lineSlope(xs[i], yk);
      tt[i] = lineSlope(xs[i], y[i]);
      drawn[i] = 1;
      if (kind === LEAF) {
        w[i] = 0.6;
        r[i] = 1.75;
      } else {
        w[i] = Math.min(1.3, 0.6 + 0.15 * Math.sqrt(t.games[i]));
        r[i] = 1.75 + 1.25 * Math.sqrt(s);
      }
    } else {
      w[i] = 0.85 + 1.65 * Math.sqrt(s);
      r[i] = 2.25 + 3.5 * Math.sqrt(s);
      drawn[i] = 1;
    }
  }
  // Root marker.
  r[0] = 5;
  drawn[0] = 1;

  let tips = 0;
  for (let i = 1; i < n; i++) if (t.kind[i] === LEAF || t.kind[i] === BUNDLE) tips++;
  const perTip = ((x1 - x0) * span * 0.6) / Math.max(1, tips);
  const leafScale = Math.min(1, Math.max(0.65, Math.sqrt(perTip) / 11));

  return { n, x, y, bx, by, r, w, drawn, kx, ky, tk, tt, leafScale, rootX: cx, groundY, rows };
}

/** Share of the root's games a node needs at k = 1 for its disc to be drawn (falls with k^2). */
export const DISC_SHARE = 0.006;

/**
 * Whether the disc of inner node `i` is drawn at zoom `k`: first moves always; others need a share
 * of the games that falls with k^2, and small nodes only show where the line actually branches
 * (a run of moves the same games all played reads as one plain branch, not a string of beads).
 */
export function discVisible(t: CanopyTree, l: CanopyLayout, i: number, k: number): boolean {
  if (!l.drawn[i] || l.r[i] <= 0) return false;
  const kind = t.kind[i];
  if (kind !== NODE && kind !== FRONTIER) return i === 0;
  if (t.depth[i] <= 1) return true;
  const min = Math.max(2, (DISC_SHARE * t.games[0]) / (k * k));
  if (t.games[i] < min) return false;
  return t.childCount[i] >= 2 || t.games[i] >= 4 * min;
}
