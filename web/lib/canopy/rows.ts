/**
 * One horizontal row per ply. Early plies (where the decisions are) get most of the height on an
 * offset log scale; a small power term makes the rows spread out again toward the crown.
 */

export interface RowScale {
  depthCap: number;
  top: number;
  bottom: number;
  y(d: number): number;
}

/**
 * y(d) = bottom - (bottom-top) * (a*ln(1+d/c)/ln(1+D/c) + (1-a)*(d/D)^p), a=0.82, c=1.5, p=2.2.
 * With D = 120: ply 1 sits ~9% up, ply 6 ~30%, ply 20 ~50%, and the last 100 plies share the crown.
 */
export function makeRowScale(
  depthCap: number,
  top: number,
  bottom: number,
  o: { a?: number; c?: number; p?: number } = {},
): RowScale {
  const a = o.a ?? 0.82;
  const c = o.c ?? 1.5;
  const p = o.p ?? 2.2;
  const D = Math.max(1, depthCap);
  const logD = Math.log1p(D / c);
  return {
    depthCap: D,
    top,
    bottom,
    y(d: number) {
      const x = Math.max(0, d);
      return bottom - (bottom - top) * ((a * Math.log1p(x / c)) / logD + (1 - a) * Math.pow(x / D, p));
    },
  };
}

/** Absolute full-move numbers that get a gutter tick. */
export const TICK_MOVES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60] as const;

/**
 * Gutter ticks at absolute full-move numbers (the row of White's move N). The root row is "now".
 * Greedy from the root up: ticks closer than `minGapPx` to the previous kept tick are dropped.
 */
export function moveTicks(
  rootPly: number,
  s: RowScale,
  minGapPx: number,
): Array<{ depth: number; label: string }> {
  const out: Array<{ depth: number; label: string }> = [{ depth: 0, label: "now" }];
  let lastY = s.y(0);
  for (const m of TICK_MOVES) {
    // White's move number m is ply 2(m-1); the row of ply P below the root is depth P - rootPly + 1.
    const d = 2 * (m - 1) - rootPly + 1;
    if (d < 1 || d > s.depthCap) continue;
    const y = s.y(d);
    if (Math.abs(lastY - y) < minGapPx) continue;
    out.push({ depth: d, label: String(m) });
    lastY = y;
  }
  return out;
}
