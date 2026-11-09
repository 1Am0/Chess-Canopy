import type { Color, Game, Source } from "../engine/types";
import { hash64 } from "./common";
import type { ParseStats } from "./pgn";
import { isStandardPlay, isStandardVariant, isStartFen } from "./standard";
import {
  isChessComUrl,
  isLichessUrl,
  lichessTimeControlLabel,
  normalizeLichessRaw,
  TIME_CONTROL_LABELS,
  timeControlLabel,
} from "./timeControl";

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const str = (v: unknown): string => (v == null ? "" : String(v));

const SOURCES: ReadonlySet<string> = new Set<Source>(["chess.com", "lichess", "pgn", "json"]);

/**
 * A per-game `source` + `playerId` pair (present in this app's own exports) when it is
 * well formed: `playerId` is "<source>:<lowercase username>".
 */
function ownerOf(r: Record<string, unknown>): { source: Source; playerId: string } | null {
  const source = r.source;
  const playerId = r.playerId;
  if (typeof source !== "string" || typeof playerId !== "string" || !SOURCES.has(source)) return null;
  const user = playerId.slice(source.length + 1);
  if (!playerId.startsWith(`${source}:`) || !user || user !== user.trim().toLowerCase()) return null;
  return { source: source as Source, playerId };
}

/**
 * Time-control label for an imported record (see timeControl.ts for the rule):
 * Lichess games are re-labelled from the raw control with Lichess thresholds; chess.com games
 * keep a valid stored label (chess.com's own time_class, which the raw string cannot
 * reproduce: chess.com called 10-minute games blitz before 2017); other games are recomputed
 * from the raw control when there is one.
 */
function labelFor(url: string, raw: string, stored: string): string {
  if (!raw) return stored;
  if (isLichessUrl(url)) return lichessTimeControlLabel(raw);
  const s = stored.toLowerCase();
  if (isChessComUrl(url) && TIME_CONTROL_LABELS.has(s)) return s;
  return timeControlLabel(raw);
}

/**
 * Parse a schema-v1 store (`{version, games}`) or a bare array of games.
 *
 * - Entries that are not objects, lack a `moves` array, or have a color other than
 *   white/black are dropped silently. Non-standard games (a chess.com `rules`, Lichess
 *   `variant`, non-initial `initial_setup`/`fen`, or moves that are not legal standard chess)
 *   are dropped and counted in `stats.skipped`.
 * - `source`/`playerId` come from the entry when it carries a well-formed pair (this app's
 *   export), so a re-import lands in the original player; otherwise from `opts`.
 * - A missing `game_id` becomes `json-<hash of date, opponent, color, result and moves>`.
 */
export function parseStoreJson(text: string, opts: { source: Source; playerId: string }, stats?: ParseStats): Game[] {
  const data: unknown = JSON.parse(text);
  const list = Array.isArray(data) ? data : (data as { games?: unknown } | null)?.games;
  if (!Array.isArray(list)) throw new Error("Invalid games file: expected {version, games} or an array");
  const out: Game[] = [];
  for (const g of list as unknown[]) {
    if (!g || typeof g !== "object") continue;
    const r = g as Record<string, unknown>;
    if (!Array.isArray(r.moves)) continue;
    if (r.color !== "white" && r.color !== "black") continue;
    const moves = r.moves.map(String);
    const termination = str(r.termination);
    const setup = r.initial_setup ?? r.initialFen ?? r.fen;
    const standard =
      (r.rules == null || isStandardVariant(r.rules)) &&
      isStandardVariant(r.variant) &&
      (setup == null || setup === "" || isStartFen(String(setup))) &&
      isStandardPlay(moves, termination);
    if (!standard) {
      if (stats) stats.skipped++;
      continue;
    }
    const url = str(r.url);
    const rawIn = str(r.time_control_raw);
    const raw = isLichessUrl(url) ? normalizeLichessRaw(rawIn) : rawIn;
    const owner = ownerOf(r) ?? opts;
    const result = str(r.result);
    out.push({
      game_id:
        r.game_id != null && r.game_id !== ""
          ? String(r.game_id)
          : `json-${hash64([str(r.date), str(r.opponent), r.color, result, moves.join(" ")].join("|"))}`,
      moves,
      result,
      color: r.color as Color,
      date: str(r.date),
      opponent: str(r.opponent),
      my_rating: num(r.my_rating),
      opponent_rating: num(r.opponent_rating),
      time_control: labelFor(url, raw, str(r.time_control)),
      time_control_raw: raw,
      termination,
      url,
      source: owner.source,
      playerId: owner.playerId,
    });
  }
  return out;
}
