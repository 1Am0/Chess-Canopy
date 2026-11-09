import { classifyResult, Trie } from "./trie";
import type { Color, Filters, Game } from "./types";

/** Parse YYYY-MM-DD like Python strptime("%Y-%m-%d"); returns a sortable number or null. */
function parseDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1 || mo < 1 || mo > 12 || d < 1) return null;
  const dim = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (d > dim[mo - 1]) return null;
  return y * 10000 + mo * 100 + d;
}

/**
 * Port of filter_games.filter_games. With `moves_start`/`moves_end` set it returns shallow
 * copies whose `moves` is sliced (0-based, end exclusive, Python slice semantics); otherwise
 * the matching game objects themselves (never mutated).
 */
export function filterGames(games: Iterable<Game>, filters: Filters = {}): Game[] {
  const f = filters;
  const df = parseDate(f.date_from);
  const dt = parseDate(f.date_to);
  const oppLower = f.opponent ? f.opponent.toLowerCase() : null;
  const start = f.moves_start ?? 0;
  const end = f.moves_end ?? undefined;
  const slice = f.moves_start != null || f.moves_end != null;
  const out: Game[] = [];

  for (const game of games) {
    if (f.color && game.color !== f.color) continue;
    if (f.result && game.result !== f.result) continue;
    if (oppLower !== null && (game.opponent ?? "").toLowerCase() !== oppLower) continue;
    if (f.time_control && game.time_control !== f.time_control) continue;
    if (f.time_control_raw && game.time_control_raw !== f.time_control_raw) continue;
    if (df !== null || dt !== null) {
      const gd = parseDate(game.date);
      if (df !== null && (gd === null || gd < df)) continue;
      if (dt !== null && (gd === null || gd > dt)) continue;
    }
    const my = game.my_rating;
    const opp = game.opponent_rating;
    if (f.min_my_rating != null && (my == null || my < f.min_my_rating)) continue;
    if (f.max_my_rating != null && (my == null || my > f.max_my_rating)) continue;
    if (f.min_opponent_rating != null && (opp == null || opp < f.min_opponent_rating)) continue;
    if (f.max_opponent_rating != null && (opp == null || opp > f.max_opponent_rating)) continue;

    // Only copy when a slice is requested; the explorer keeps references otherwise.
    if (slice) out.push({ ...game, moves: (game.moves ?? []).slice(start, end) });
    else out.push(game);
  }
  return out;
}

/**
 * Port of build_color_tries. Python raises ValueError on unknown result tokens (e.g. "*");
 * here such games are skipped (never throw) so aborted/unfinished games cannot break the explorer.
 * Games with a color other than white/black are skipped, as in Python.
 */
export function buildColorTries(games: Iterable<Game>): Record<Color, Trie> {
  const tries: Record<Color, Trie> = { white: new Trie(), black: new Trie() };
  for (const game of games) {
    const trie = game.color === "white" || game.color === "black" ? tries[game.color] : undefined;
    if (!trie) continue;
    const result = game.result ?? "*";
    if (classifyResult(result) === null) continue;
    trie.addGame(game.moves ?? [], result);
  }
  return tries;
}
