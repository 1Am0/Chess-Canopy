/** One horizontal row per ply, on a blended log/power scale (early moves get room, the late game packs). */

export interface RowScale {
  depthCap: number;
  top: number;
  bottom: number;
  y(d: number): number;
}

/** y(d) = bottom - (bottom-top) * (a*log2(1+d)/log2(1+D) + (1-a)*(d/D)^p), a=0.45, p=1.8. */
export function makeRowScale(
  depthCap: number,
  top: number,
  bottom: number,
  o: { a?: number; p?: number } = {},
): RowScale {
  const a = o.a ?? 0.45;
  const p = o.p ?? 1.8;
  const D = Math.max(1, depthCap);
  const logD = Math.log2(1 + D);
  return {
    depthCap: D,
    top,
    bottom,
    y(d: number) {
      const c = Math.max(0, d);
      return bottom - (bottom - top) * ((a * Math.log2(1 + c)) / logD + (1 - a) * Math.pow(c / D, p));
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
