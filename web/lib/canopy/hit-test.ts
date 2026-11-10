import type { CanopyLayout } from "./layout";

export interface HitIndex {
  /** Nearest node id within `radiusWorld` of (wx, wy), or -1. Never the root. */
  nearest(wx: number, wy: number, radiusWorld: number): number;
}

/** Uniform grid over node positions (including undrawn nodes and leaf tips). */
export function buildHitIndex(l: CanopyLayout, cellPx = 24): HitIndex {
  const n = l.n;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < n; i++) {
    if (l.x[i] < minX) minX = l.x[i];
    if (l.x[i] > maxX) maxX = l.x[i];
    if (l.y[i] < minY) minY = l.y[i];
    if (l.y[i] > maxY) maxY = l.y[i];
  }
  if (n <= 1) return { nearest: () => -1 };
  const cols = Math.max(1, Math.floor((maxX - minX) / cellPx) + 1);
  const rows = Math.max(1, Math.floor((maxY - minY) / cellPx) + 1);
  const cellOf = (i: number) =>
    Math.floor((l.y[i] - minY) / cellPx) * cols + Math.floor((l.x[i] - minX) / cellPx);
  const start = new Int32Array(cols * rows + 1);
  for (let i = 1; i < n; i++) start[cellOf(i) + 1]++;
  for (let c = 0; c < cols * rows; c++) start[c + 1] += start[c];
  const fill = start.slice(0, cols * rows);
  const items = new Int32Array(n - 1);
  for (let i = 1; i < n; i++) items[fill[cellOf(i)]++] = i;

  return {
    nearest(wx, wy, radiusWorld) {
      if (!(radiusWorld >= 0)) return -1;
      const c0 = Math.max(0, Math.floor((wx - radiusWorld - minX) / cellPx));
      const c1 = Math.min(cols - 1, Math.floor((wx + radiusWorld - minX) / cellPx));
      const r0 = Math.max(0, Math.floor((wy - radiusWorld - minY) / cellPx));
      const r1 = Math.min(rows - 1, Math.floor((wy + radiusWorld - minY) / cellPx));
      let best = -1;
      let bd = radiusWorld * radiusWorld;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const cell = r * cols + c;
          for (let p = start[cell]; p < start[cell + 1]; p++) {
            const i = items[p];
            const dx = l.x[i] - wx;
            const dy = l.y[i] - wy;
            const d = dx * dx + dy * dy;
            if (d < bd || (d === bd && best !== -1 && i < best)) {
              bd = d;
              best = i;
            }
          }
        }
      }
      return best;
    },
  };
}
