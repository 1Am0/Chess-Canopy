import type { Color, Game } from "../engine/types";
import { lastSegment, parsePgnDate, todayIso } from "./common";
import { extractSanMoves, parsePgnHeaders } from "./san";
import { timeControlLabel } from "./timeControl";

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

function eloOf(v: string | undefined): number {
  // Python: int(headers.get("WhiteElo", 0)); missing/invalid -> 0 here (Python would drop the game on invalid).
  const n = v === undefined ? 0 : parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Port of import_pgn.py + parse_game. Only games where `username` played White or Black are kept.
 * Deviations: SAN is taken from the movetext as written (no replay/normalisation of check marks);
 * a missing/"?" Site yields a `pgn-<n>` game_id (Python would use "?"), where n is the 1-based game index.
 */
export function parsePgnText(text: string, username: string): Game[] {
  const userL = username.trim().toLowerCase();
  const out: Game[] = [];
  const seen = new Set<string>();
  splitPgnGames(text).forEach((chunk, i) => {
    const h = parsePgnHeaders(chunk);
    const whiteName = h.White ?? "";
    const blackName = h.Black ?? "";
    if (whiteName.toLowerCase() !== userL && blackName.toLowerCase() !== userL) return;
    const color: Color = whiteName.toLowerCase() === userL ? "white" : "black";
    const opponent = color === "white" ? blackName : whiteName;

    const rawResult = h.Result ?? "*";
    let result: string;
    if (rawResult === "1-0") result = color === "white" ? "1-0" : "0-1";
    else if (rawResult === "0-1") result = color === "white" ? "0-1" : "1-0";
    else if (rawResult === "1/2-1/2" || rawResult === "½-½") result = "1/2-1/2";
    else result = rawResult;

    const dateTag = h.EndDate || h.UTCDate || h.Date || "0000.00.00";
    const date = parsePgnDate(dateTag) ?? todayIso();

    const siteRaw = h.Link || h.Site || "";
    const url = siteRaw === "?" ? "" : siteRaw;
    let game_id = url ? lastSegment(url) : h.Event && h.Event !== "?" ? h.Event : "";
    if (!game_id) game_id = `pgn-${i + 1}`;
    if (seen.has(game_id)) return;
    seen.add(game_id);

    const tcRaw = h.TimeControl ?? "";
    out.push({
      game_id,
      moves: extractSanMoves(chunk),
      result,
      color,
      date,
      opponent,
      my_rating: eloOf(color === "white" ? h.WhiteElo : h.BlackElo),
      opponent_rating: eloOf(color === "white" ? h.BlackElo : h.WhiteElo),
      time_control: (h.TimeClass ? h.TimeClass.toLowerCase() : timeControlLabel(tcRaw)),
      time_control_raw: tcRaw,
      termination: h.Termination ?? "",
      url,
      source: "pgn",
      playerId: `pgn:${userL}`,
    });
  });
  return out;
}
