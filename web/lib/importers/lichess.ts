import type { Color, Game } from "../engine/types";
import { abortError, HttpError, isoDateFromMs } from "./common";

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

/** Stream a user's games as raw NDJSON objects (newest first). */
export async function* fetchLichessGames(username: string, opts: FetchLichessOptions = {}): AsyncGenerator<LichessRawGame> {
  const f = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const params = new URLSearchParams({ moves: "true", clocks: "false", evals: "false", opening: "false", pgnInJson: "false" });
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

const SPEED_MAP: Record<string, string> = { ultraBullet: "bullet", correspondence: "daily" };

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

/** Parse one Lichess NDJSON game. Returns null for non-standard variants or missing id. */
export function parseLichessGame(obj: LichessRawGame, username: string): Game | null {
  if (!obj.id) return null;
  if (obj.variant && obj.variant !== "standard") return null;
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

  let tcRaw = "";
  if (obj.clock && obj.clock.initial != null) tcRaw = `${obj.clock.initial}+${obj.clock.increment ?? 0}`;
  else if (obj.daysPerTurn) tcRaw = `1/${obj.daysPerTurn * 86400}`;

  const speed = obj.speed ?? "";
  const rating = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const movesStr = (obj.moves ?? "").trim();

  return {
    game_id: obj.id,
    moves: movesStr ? movesStr.split(/\s+/) : [],
    result,
    color,
    date: obj.createdAt != null ? isoDateFromMs(obj.createdAt) : "",
    opponent: color === "white" ? black : white,
    my_rating: rating(me?.rating),
    opponent_rating: rating(opp?.rating),
    time_control: SPEED_MAP[speed] ?? speed,
    time_control_raw: tcRaw,
    termination: terminationOf(obj.status),
    url: `https://lichess.org/${obj.id}`,
    source: "lichess",
    playerId: `lichess:${userL}`,
  };
}
