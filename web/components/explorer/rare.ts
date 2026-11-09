/** A move is "rare" when it has fewer than max(3, 1%) of the position's games. */
export function rareThreshold(positionTotal: number): number {
  return Math.max(3, positionTotal * 0.01);
}

/**
 * Splits moves into common and rare ones. The move table and the board arrows both use
 * this so they agree. If nothing is common, nothing is hidden (everything counts as common).
 */
export function splitRare<T extends { stats: { total: number } }>(rows: T[], positionTotal: number): { common: T[]; rare: T[] } {
  const threshold = rareThreshold(positionTotal);
  const common = rows.filter((r) => r.stats.total >= threshold);
  if (common.length === 0) return { common: rows, rare: [] };
  return { common, rare: rows.filter((r) => r.stats.total < threshold) };
}
