/** Shared score styling: >=55% win color, <=45% loss color, else foreground. */
export function scoreClass(sc: number): string {
  return sc >= 0.55 ? "text-win" : sc <= 0.45 ? "text-loss" : "text-foreground";
}

/** Share of a position, "<1%" rather than "0%" for tiny non-zero shares. */
export function shareLabel(n: number, total: number): string {
  if (!total || n <= 0) return "–";
  const p = (n / total) * 100;
  return p < 1 ? "<1%" : `${Math.round(p)}%`;
}
