/** Share of a position, "<1%" rather than "0%" for tiny non-zero shares. */
export function shareLabel(n: number, total: number): string {
  if (!total || n <= 0) return "–";
  const p = (n / total) * 100;
  return p < 1 ? "<1%" : `${Math.round(p)}%`;
}
