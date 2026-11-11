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

/**
 * Low-sample honesty: a move's stats read as thin when it has fewer than 3 games, or,
 * in a well-populated position (40+ games), fewer than 5% of them. Purely visual: the
 * move table draws such rows' bar and score lighter.
 */
export function isLowSample(total: number, positionTotal: number): boolean {
  return total < 3 || (positionTotal >= 40 && total < positionTotal * 0.05);
}
