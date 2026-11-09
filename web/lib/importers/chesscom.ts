import type { Color, Game } from "../engine/types";
import { abortError, HttpError, isoDateFromMs, lastSegment, sleep } from "./common";
import { extractSanMoves, parsePgnHeaders } from "./san";
import { timeControlLabel } from "./timeControl";

export interface ChessComPlayerSide {
  username?: string;
  rating?: number;
  result?: string;
}

export interface ChessComRawGame {
  url?: string;
  pgn?: string;
  time_control?: string;
  time_class?: string;
  end_time?: number;
  rules?: string;
  white?: ChessComPlayerSide;
  black?: ChessComPlayerSide;
}

export interface ChessComProgress {
  /** Months fetched so far */
  done: number;
  total: number;
  /** Games fetched so far */
  games: number;
  /** "YYYY/MM" of the month just completed */
  month?: string;
}

export interface FetchChessComOptions {
  /** "YYYY/MM": only fetch archives at or after this month */
  sinceMonth?: string | null;
  signal?: AbortSignal;
  onProgress?: (p: ChessComProgress) => void;
  fetchImpl?: typeof fetch;
  /** Injectable for tests; defaults to an abortable setTimeout */
  sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>;
  concurrency?: number;
  maxTries?: number;
  baseDelayMs?: number;
}

export interface ChessComFetchResult {
  /** Raw games, newest first (same order as the Python importer) */
  games: ChessComRawGame[];
  /** Newest archive month fetched, "YYYY/MM", or null when there are no archives */
  lastMonth: string | null;
}


async function fetchJson(url: string, o: Required<Pick<FetchChessComOptions, "maxTries" | "baseDelayMs">> & {
  fetchImpl: typeof fetch;
  sleepImpl: (ms: number, signal?: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
}): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < o.maxTries; attempt++) {
    if (o.signal?.aborted) throw abortError();
    try {
      const res = await o.fetchImpl(url, { signal: o.signal, headers: { Accept: "application/json" } });
      if (res.ok) return await res.json();
      const err = new HttpError(res.status, `chess.com request failed (${res.status}) for ${url}`);
      if (res.status === 429 || res.status >= 500) lastErr = err;
      else throw err;
    } catch (e) {
      if (o.signal?.aborted || (e instanceof Error && e.name === "AbortError")) throw abortError();
      if (e instanceof HttpError && e.status !== 429 && e.status < 500) throw e;
      lastErr = e;
    }
    if (attempt < o.maxTries - 1) await o.sleepImpl(o.baseDelayMs * 2 ** attempt, o.signal);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Fetch all (or incremental) monthly archives for a chess.com user. */
export async function fetchChessComGames(username: string, opts: FetchChessComOptions = {}): Promise<ChessComFetchResult> {
  const o = {
    fetchImpl: opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a)),
    sleepImpl: opts.sleepImpl ?? sleep,
    signal: opts.signal,
    maxTries: opts.maxTries ?? 4,
    baseDelayMs: opts.baseDelayMs ?? 500,
  };
  const user = encodeURIComponent(username.trim().toLowerCase());
  const idx = (await fetchJson(`https://api.chess.com/pub/player/${user}/games/archives`, o)) as { archives?: string[] };
  let archives = idx.archives ?? [];
  const monthOf = (u: string) => u.split("/").slice(-2).join("/");
  if (opts.sinceMonth) archives = archives.filter((u) => monthOf(u) >= opts.sinceMonth!);
  const ordered = [...archives].reverse(); // newest first
  const total = ordered.length;
  const results: ChessComRawGame[][] = new Array(total);
  let next = 0;
  let done = 0;
  let gameCount = 0;
  const workers = Math.max(1, Math.min(opts.concurrency ?? 4, total));

  const run = async () => {
    while (next < total) {
      if (o.signal?.aborted) throw abortError();
      const i = next++;
      const data = (await fetchJson(ordered[i], o)) as { games?: ChessComRawGame[] };
      const games = [...(data.games ?? [])].reverse();
      results[i] = games;
      done++;
      gameCount += games.length;
      opts.onProgress?.({ done, total, games: gameCount, month: monthOf(ordered[i]) });
    }
  };
  await Promise.all(Array.from({ length: workers }, run));
  return { games: results.flat(), lastMonth: total ? monthOf(ordered[0]) : null };
}

/** Parse one chess.com archive game into a Game. Returns null for non-standard variants or missing PGN. */
export function parseChessComGame(raw: ChessComRawGame, username: string): Game | null {
  if (raw.rules && raw.rules !== "chess") return null;
  const pgn = raw.pgn;
  if (!pgn) return null;
  const headers = parsePgnHeaders(pgn);
  const userL = username.trim().toLowerCase();
  const whiteName = raw.white?.username ?? headers.White ?? "";
  const color: Color = whiteName.toLowerCase() === userL ? "white" : "black";
  const me = color === "white" ? raw.white : raw.black;
  const opp = color === "white" ? raw.black : raw.white;

  let whiteScore: "win" | "loss" | "draw";
  if (raw.white?.result === "win") whiteScore = "win";
  else if (raw.black?.result === "win") whiteScore = "loss";
  else if (raw.white?.result === undefined && raw.black?.result === undefined) {
    const r = headers.Result;
    whiteScore = r === "1-0" ? "win" : r === "0-1" ? "loss" : "draw";
  } else whiteScore = "draw";
  const result =
    whiteScore === "draw" ? "1/2-1/2" : (whiteScore === "win") === (color === "white") ? "1-0" : "0-1";

  const url = raw.url ?? headers.Link ?? headers.Site ?? "";
  const game_id = url ? lastSegment(url) : (headers.Event ?? "");
  const date =
    raw.end_time != null
      ? isoDateFromMs(raw.end_time * 1000)
      : (headers.EndDate ?? headers.UTCDate ?? headers.Date ?? "").replace(/\./g, "-");
  const tcRaw = raw.time_control ?? headers.TimeControl ?? "";
  const rating = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  return {
    game_id,
    moves: extractSanMoves(pgn),
    result,
    color,
    date,
    opponent: (opp?.username ?? (color === "white" ? headers.Black : headers.White)) ?? "",
    my_rating: rating(me?.rating),
    opponent_rating: rating(opp?.rating),
    time_control: raw.time_class ? raw.time_class.toLowerCase() : timeControlLabel(tcRaw),
    time_control_raw: tcRaw,
    termination: headers.Termination ?? "",
    url,
    source: "chess.com",
    playerId: `chess.com:${userL}`,
  };
}
