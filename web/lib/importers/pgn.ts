import type { Color, Game } from "../engine/types";
import { hash64, parsePgnDate, pyInt, urlGameId } from "./common";
import { extractSanMoves, parsePgnHeaders } from "./san";
import { isStandardHeaders, isStandardPlay } from "./standard";
import { isLichessUrl, lichessSpeedLabel, lichessTimeControlLabel, normalizeLichessRaw, timeControlLabel } from "./timeControl";

const HEADER_LINE = /^\s*\[\s*[A-Za-z0-9_]+\s+"/;

/** Split a multi-game PGN text into per-game chunks. */
export function splitPgnGames(text: string): string[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const chunks: string[] = [];
  let cur: string[] = [];
  let sawMoves = false;
  for (const line of src.split(/\r?\n/)) {
    const isHeader = HEADER_LINE.test(line);
    if (isHeader && sawMoves) {
      chunks.push(cur.join("\n"));
      cur = [];
      sawMoves = false;
    }
    if (!isHeader && line.trim() !== "" && !line.startsWith("%")) sawMoves = true;
    cur.push(line);
  }
  if (cur.some((l) => l.trim() !== "")) chunks.push(cur.join("\n"));
  return chunks.filter((c) => HEADER_LINE.test(c.split("\n").find((l) => l.trim() !== "") ?? ""));
}

/** Python `_parse_elo`: missing, "?" or non-numeric Elo is null (never 0). */
function eloOf(v: string | undefined): number | null {
  return pyInt(v);
}

export interface ParseStats {
  /** Games dropped because they are not standard chess from the initial position. */
  skipped: number;
}

/**
 * Port of import_pgn.py + parse_game. Only games where `username` played White or Black are kept.
 *
 * - Variant / from-position games (`Variant`, `SetUp "1"`, non-initial `FEN`) and games whose
 *   moves are not legal standard chess are dropped and counted in `stats.skipped`.
 * - `game_id` is the last path segment of an http(s) `Link`/`Site`; otherwise a content hash
 *   `pgn-<16 hex>` of the players, date, round, event, result and moves, so games without a URL
 *   never collide (Python would use the Site/Event text, e.g. "Chess.com" for every game).
 * - SAN is taken from the movetext as written (no replay/normalisation of check marks).
 */
export function parsePgnText(text: string, username: string, stats?: ParseStats): Game[] {
  const userL = username.trim().toLowerCase();
  const out: Game[] = [];
  const seen = new Set<string>();
  for (const chunk of splitPgnGames(text)) {
    const h = parsePgnHeaders(chunk);
    const whiteName = h.White ?? "";
    const blackName = h.Black ?? "";
    if (whiteName.toLowerCase() !== userL && blackName.toLowerCase() !== userL) continue;
    const moves = extractSanMoves(chunk);
    if (!isStandardHeaders(h) || !isStandardPlay(moves, h.Termination)) {
      if (stats) stats.skipped++;
      continue;
    }
    const color: Color = whiteName.toLowerCase() === userL ? "white" : "black";
    const opponent = color === "white" ? blackName : whiteName;

    const rawResult = h.Result ?? "*";
    let result: string;
    if (rawResult === "1-0") result = color === "white" ? "1-0" : "0-1";
    else if (rawResult === "0-1") result = color === "white" ? "0-1" : "1-0";
    else if (rawResult === "1/2-1/2" || rawResult === "½-½") result = "1/2-1/2";
    else result = rawResult;

    const dateTag = h.EndDate || h.UTCDate || h.Date || "";
    const date = parsePgnDate(dateTag) ?? "";

    const linkId = urlGameId(h.Link);
    const siteId = linkId ? null : urlGameId(h.Site);
    const url = linkId ? h.Link!.trim() : siteId ? h.Site!.trim() : "";
    const game_id =
      linkId ??
      siteId ??
      `pgn-${hash64([h.White, h.Black, h.Date, h.UTCDate, h.UTCTime, h.Round, h.Event, h.Result, moves.join(" ")].map((v) => v ?? "").join("|"))}`;
    // Only byte-identical games share an id, so this drops true duplicates only.
    if (seen.has(game_id)) continue;
    seen.add(game_id);

    const lichess = isLichessUrl(url);
    const tcHeader = h.TimeControl ?? "";
    const tcRaw = lichess ? normalizeLichessRaw(tcHeader) : tcHeader;
    let time_control: string;
    if (h.TimeClass) time_control = h.TimeClass.toLowerCase();
    else if (lichess) time_control = lichessSpeedLabel(h.Event) ?? lichessTimeControlLabel(tcRaw);
    else time_control = timeControlLabel(tcRaw);

    out.push({
      game_id,
      moves,
      result,
      color,
      date,
      opponent,
      my_rating: eloOf(color === "white" ? h.WhiteElo : h.BlackElo),
      opponent_rating: eloOf(color === "white" ? h.BlackElo : h.WhiteElo),
      time_control,
      time_control_raw: tcRaw,
      termination: h.Termination ?? "",
      url,
      source: "pgn",
      playerId: `pgn:${userL}`,
    });
  }
  return out;
}
