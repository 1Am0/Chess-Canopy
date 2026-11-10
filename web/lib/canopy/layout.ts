import { BUNDLE, LEAF, type CanopyTree } from "./types";
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

  const span = bottom - top || 1;
  for (let i = 0; i < n; i++) {
    const d = t.depth[i];
    const yy = rows.y(d);
    const f = Math.min(1, Math.max(0, (bottom - yy) / span));
    const flare = 0.18 + 0.82 * Math.pow(f, 0.65);
    const xx = i === 0 ? cx : cx + (x0 + (x1 - x0) * xs[i] - cx) * flare;
    x[i] = xx;
    y[i] = yy;
    bx[i] = xx;
    by[i] = yy;
  }

  const minDisc = Math.max(3, rootGames * 0.002);
  w[0] = 2.5;
  for (let i = 1; i < n; i++) {
    const p = t.parent[i];
    bx[i] = x[p];
    by[i] = y[p];
    const kind = t.kind[i];
    const s = Math.min(1, t.games[i] / rootGames);
    if (kind === LEAF) {
      w[i] = 0.75;
      r[i] = 2;
      drawn[i] = 1;
    } else if (kind === BUNDLE) {
      w[i] = Math.min(1.6, 0.75 + 0.2 * Math.sqrt(t.games[i]));
      r[i] = 2 + 1.5 * Math.sqrt(s);
      drawn[i] = 1;
    } else {
      w[i] = 0.9 + 1.6 * Math.sqrt(s);
      if (t.games[i] >= minDisc || t.depth[i] <= 2) {
        r[i] = 2.25 + 3.25 * Math.sqrt(s);
        drawn[i] = 1;
      }
    }
  }
  // Root marker.
  r[0] = 5;
  drawn[0] = 1;

  return { n, x, y, bx, by, r, w, drawn, rootX: cx, groundY, rows };
}
