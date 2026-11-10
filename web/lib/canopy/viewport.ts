import type { CanopyLayout } from "./layout";

/** screen = world * k + t */
export interface View {
  k: number;
  tx: number;
  ty: number;
}
export const IDENTITY: View = Object.freeze({ k: 1, tx: 0, ty: 0 });
export const K_MAX = 12;
type Box = { width: number; height: number };

/** k in [1, kMax], and the content always covers the box (no empty margin appears). */
export function clampView(v: View, box: Box, kMax = K_MAX): View {
  const k = Math.min(kMax, Math.max(1, Number.isFinite(v.k) ? v.k : 1));
  const minTx = box.width * (1 - k);
  const minTy = box.height * (1 - k);
  return {
    k,
    tx: Math.min(0, Math.max(minTx, Number.isFinite(v.tx) ? v.tx : 0)),
    ty: Math.min(0, Math.max(minTy, Number.isFinite(v.ty) ? v.ty : 0)),
  };
}

/** Scale by `factor` keeping the world point under (sx, sy) fixed (up to clamping). */
export function zoomAt(v: View, factor: number, sx: number, sy: number, box: Box): View {
  const k = Math.min(K_MAX, Math.max(1, v.k * factor));
  const r = k / v.k;
  return clampView({ k, tx: sx - (sx - v.tx) * r, ty: sy - (sy - v.ty) * r }, box);
}

export function panBy(v: View, dx: number, dy: number, box: Box): View {
  return clampView({ k: v.k, tx: v.tx + dx, ty: v.ty + dy }, box);
}

export function toWorld(v: View, sx: number, sy: number): [number, number] {
  return [(sx - v.tx) / v.k, (sy - v.ty) / v.k];
}

export function toScreen(v: View, wx: number, wy: number): [number, number] {
  return [wx * v.k + v.tx, wy * v.k + v.ty];
}

/** Minimal pan so node `i` is inside the box with `margin` px to spare (zoom unchanged). */
export function revealNode(v: View, l: CanopyLayout, i: number, box: Box, margin = 28): View {
  if (i < 0 || i >= l.n) return v;
  const [sx, sy] = toScreen(v, l.x[i], l.y[i]);
  const m = Math.min(margin, box.width / 2, box.height / 2);
  let dx = 0;
  let dy = 0;
  if (sx < m) dx = m - sx;
  else if (sx > box.width - m) dx = box.width - m - sx;
  if (sy < m) dy = m - sy;
  else if (sy > box.height - m) dy = box.height - m - sy;
  return dx === 0 && dy === 0 ? v : panBy(v, dx, dy, box);
}

export function lerpView(a: View, b: View, t: number): View {
  return { k: a.k + (b.k - a.k) * t, tx: a.tx + (b.tx - a.tx) * t, ty: a.ty + (b.ty - a.ty) * t };
}
