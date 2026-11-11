import { splitRare } from "@/components/explorer/rare";

type Counts = { total: number; wins: number; draws: number };
/** Same definition as `score` in lib/format: (wins + draws / 2) / total, from the player's side. */
const scoreOf = (s: Counts) => (s.total ? (s.wins + s.draws / 2) / s.total : 0);

export interface BestMove {
  move: string;
  score: number;
  games: number;
}

/**
 * The candidate with the best score for the player, among the moves the table shows by default
 * (not the rare ones). Needs at least two such moves to be a comparison, and a strict winner:
 * on a tie there is no "best", so nothing is claimed.
 */
export function bestCandidate(next: { move: string; stats: Counts }[], positionTotal: number): BestMove | null {
  const { common } = splitRare(next, positionTotal);
  if (common.length < 2) return null;
  const ranked = [...common].sort((a, b) => scoreOf(b.stats) - scoreOf(a.stats) || b.stats.total - a.stats.total);
  const top = ranked[0];
  if (scoreOf(top.stats) === scoreOf(ranked[1].stats)) return null;
  return { move: top.move, score: scoreOf(top.stats), games: top.stats.total };
}
