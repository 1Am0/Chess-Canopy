import type { Color, Game } from "../engine/types";
import { abortError, HttpError, isoDateFromMs } from "./common";
import { isStandardPlay, isStandardVariant, isStartFen } from "./standard";
import { lichessSpeedLabel, lichessTimeControlLabel } from "./timeControl";

export interface LichessRawPlayer {
  user?: { name?: string; id?: string };
  rating?: number;
  aiLevel?: number;
}

export interface LichessRawGame {
  id?: string;
  rated?: boolean;
  variant?: string;
  speed?: string;
  status?: string;
  createdAt?: number;
  moves?: string;
  winner?: "white" | "black";
  players?: { white?: LichessRawPlayer; black?: LichessRawPlayer };
  clock?: { initial?: number; increment?: number };
  daysPerTurn?: number;
  /** Present for games that started from a custom position */
  initialFen?: string;
}

/** Still being played (correspondence / in progress): not stored, and the sync watermark stops before it. */
export function isOngoing(obj: LichessRawGame): boolean {
  return obj.status === "created" || obj.status === "started";
}

/** Finished without a result (aborted, never started): nothing to count. */
export function isUnfinished(obj: LichessRawGame): boolean {
  return isOngoing(obj) || obj.status === "aborted" || obj.status === "noStart" || obj.status === "unknownFinish";
}

export interface FetchLichessOptions {
  /** ms timestamp: only games created at/after this time */
  since?: number | null;
  signal?: AbortSignal;
  /** Called with the running game count */
  onProgress?: (count: number) => void;
  fetchImpl?: typeof fetch;
}

/** Yield one string per non-empty line of a byte stream. */
export async function* readLines(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  try {
    for (;;) {
      if (signal?.aborted) throw abortError();
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) yield line;
      }
    }
    buf += decoder.decode();
    const rest = buf.trim();
    if (rest) yield rest;
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Stream a user's games as raw NDJSON objects, oldest first (`sort=dateAsc`), including
 * ongoing games (`ongoing=true`) so the caller can stop its watermark before them.
 */
export async function* fetchLichessGames(username: string, opts: FetchLichessOptions = {}): AsyncGenerator<LichessRawGame> {
  const f = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const params = new URLSearchParams({
    moves: "true",
    clocks: "false",
    evals: "false",
    opening: "false",
    pgnInJson: "false",
    sort: "dateAsc",
    ongoing: "true",
  });
  if (opts.since != null) params.set("since", String(opts.since));
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username.trim())}?${params}`;
  const res = await f(url, { signal: opts.signal, headers: { Accept: "application/x-ndjson" } });
  if (!res.ok) throw new HttpError(res.status, `Lichess request failed (${res.status})`);
  let count = 0;
  const emit = function* (line: string): Generator<LichessRawGame> {
    count++;
    yield JSON.parse(line) as LichessRawGame;
  };
  if (res.body) {
    for await (const line of readLines(res.body, opts.signal)) {
      yield* emit(line);
      opts.onProgress?.(count);
    }
  } else {
    for (const line of (await res.text()).split("\n")) {
      if (!line.trim()) continue;
      yield* emit(line.trim());
      opts.onProgress?.(count);
    }
  }
}

function terminationOf(status: string | undefined): string {
  switch (status) {
    case "outoftime":
      return "Time forfeit";
    case "noStart":
    case "timeout":
      return "Abandoned";
    case "cheat":
      return "Rules infraction";
    case "created":
    case "started":
    case "aborted":
      return "Unterminated";
    default:
      return "Normal";
  }
}

function nameOf(p: LichessRawPlayer | undefined): string {
  if (p?.user?.name) return p.user.name;
  if (p?.aiLevel != null) return `Stockfish level ${p.aiLevel}`;
  return "Anonymous";
}

/**
 * Parse one Lichess NDJSON game. Returns null for a missing id and for anything that is not
 * standard chess from the initial position (variant, initialFen, or moves that do not replay).
 * Unfinished games come back with result "*"; the service does not store them.
 */
export function parseLichessGame(obj: LichessRawGame, username: string): Game | null {
  if (!obj.id) return null;
  if (!isStandardVariant(obj.variant)) return null;
  if (obj.initialFen && !isStartFen(obj.initialFen)) return null;
  const movesStr = (obj.moves ?? "").trim();
  const moves = movesStr ? movesStr.split(/\s+/) : [];
  if (!isStandardPlay(moves)) return null;
  const userL = username.trim().toLowerCase();
  const white = nameOf(obj.players?.white);
  const black = nameOf(obj.players?.black);
  const color: Color = white.toLowerCase() === userL ? "white" : "black";
  const me = color === "white" ? obj.players?.white : obj.players?.black;
  const opp = color === "white" ? obj.players?.black : obj.players?.white;

  let result: string;
  if (obj.winner) result = (obj.winner === color) ? "1-0" : "0-1";
  else if (["aborted", "noStart", "created", "started", "unknownFinish"].includes(obj.status ?? "")) result = "*";
  else result = "1/2-1/2";

  // Raw control in the same form as the Python CLI: "base+inc", "1/<seconds>" for days per
  // move, "-" for unlimited correspondence.
  let tcRaw = "";
  if (obj.clock && obj.clock.initial != null) tcRaw = `${obj.clock.initial}+${obj.clock.increment ?? 0}`;
  else if (obj.daysPerTurn) tcRaw = `1/${obj.daysPerTurn * 86400}`;
  else if (obj.speed === "correspondence") tcRaw = "-";

  const rating = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  return {
    game_id: obj.id,
    moves,
    result,
    color,
    date: obj.createdAt != null ? isoDateFromMs(obj.createdAt) : "",
    opponent: color === "white" ? black : white,
    my_rating: rating(me?.rating),
    opponent_rating: rating(opp?.rating),
    time_control: lichessSpeedLabel(obj.speed) ?? lichessTimeControlLabel(tcRaw),
    time_control_raw: tcRaw,
    termination: terminationOf(obj.status),
    url: `https://lichess.org/${obj.id}`,
    source: "lichess",
    playerId: `lichess:${userL}`,
  };
}
