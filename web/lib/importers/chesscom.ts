import type { Color, Game } from "../engine/types";
import { abortError, HttpError, isoDateFromMs, lastSegment, sleep } from "./common";
import { extractSanMoves, parsePgnHeaders } from "./san";
import { isStandardHeaders, isStandardPlay, isStandardVariant, isStartFen } from "./standard";
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
  /** FEN the game started from (the standard start FEN for normal games) */
  initial_setup?: string;
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
  /**
   * Incremental mode: months are fetched oldest first and handed to `onMonth` strictly in
   * that order (awaited, one at a time), so the caller can save each month as it arrives and
   * keep a watermark over the contiguous run of saved months. When set, the result's `games`
   * is empty (the games were delivered). If a month fails or the crawl is cancelled, every
   * earlier month has been delivered before the error is thrown.
   */
  onMonth?: (month: string, games: ChessComRawGame[]) => void | Promise<void>;
}

export interface ChessComFetchResult {
  /** Raw games, newest first (same order as the Python importer) */
  games: ChessComRawGame[];
  /** Newest archive month fetched, "YYYY/MM", or null when there are no archives */
  lastMonth: string | null;
}


/** Retry-After (seconds or an HTTP date) in ms, or null. */
function retryAfterMs(res: Response): number | null {
  const v = res.headers?.get?.("retry-after");
  if (!v) return null;
  const secs = Number(v);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(v);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
}

async function bodyText(res: Response): Promise<string> {
  try {
    const t = (await res.text()).trim();
    if (!t) return "";
    // JSON error bodies look like {"code":0,"message":"..."}
    let j: { message?: unknown } | null = null;
    try {
      j = JSON.parse(t) as { message?: unknown };
    } catch {
      return t.slice(0, 200); // plain text
    }
    return typeof j?.message === "string" ? j.message.slice(0, 200) : "";
  } catch {
    return "";
  }
}

const MAX_DELAY_MS = 30_000;

async function fetchJson(url: string, o: Required<Pick<FetchChessComOptions, "maxTries" | "baseDelayMs">> & {
  fetchImpl: typeof fetch;
  sleepImpl: (ms: number, signal?: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
}): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < o.maxTries; attempt++) {
    if (o.signal?.aborted) throw abortError();
    let wait = Math.min(MAX_DELAY_MS, o.baseDelayMs * 2 ** attempt);
    try {
      const res = await o.fetchImpl(url, { signal: o.signal, headers: { Accept: "application/json" } });
      if (res.ok) return await res.json();
      const body = await bodyText(res);
      const err = new HttpError(res.status, `chess.com request failed (${res.status})${body ? `: ${body}` : ""}`, body);
      // Only rate limiting and server errors are worth retrying; 403/404 are final.
      if (res.status !== 429 && res.status < 500) throw err;
      lastErr = err;
      const ra = retryAfterMs(res);
      if (ra !== null) wait = Math.min(60_000, Math.max(wait, ra));
    } catch (e) {
      if (o.signal?.aborted || (e instanceof Error && e.name === "AbortError")) throw abortError();
      if (e instanceof HttpError && e.status !== 429 && e.status < 500) throw e;
      lastErr = e;
    }
    if (attempt < o.maxTries - 1) await o.sleepImpl(wait, o.signal);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Fetch all (or incremental) monthly archives for a chess.com user. At most 2 archives are
 * fetched at once (chess.com blocks heavier crawls with a 403); 429/5xx are retried with
 * exponential backoff (honouring Retry-After), and the first failure cancels the other fetches.
 */
export async function fetchChessComGames(username: string, opts: FetchChessComOptions = {}): Promise<ChessComFetchResult> {
  // One controller for this crawl, so a failing archive stops its siblings.
  const crawl = new AbortController();
  const onOuterAbort = () => crawl.abort();
  if (opts.signal?.aborted) crawl.abort();
  opts.signal?.addEventListener("abort", onOuterAbort, { once: true });
  const o = {
    fetchImpl: opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a)),
    sleepImpl: opts.sleepImpl ?? sleep,
    signal: crawl.signal,
    maxTries: opts.maxTries ?? 5,
    baseDelayMs: opts.baseDelayMs ?? 1000,
  };
  try {
    const user = encodeURIComponent(username.trim().toLowerCase());
    const idx = (await fetchJson(`https://api.chess.com/pub/player/${user}/games/archives`, o)) as { archives?: string[] };
    let archives = idx.archives ?? [];
    const monthOf = (u: string) => u.split("/").slice(-2).join("/");
    if (opts.sinceMonth) archives = archives.filter((u) => monthOf(u) >= opts.sinceMonth!);
    const incremental = !!opts.onMonth;
    const ordered = incremental ? [...archives] : [...archives].reverse(); // oldest first when saving as we go, else newest first
    const total = ordered.length;
    const results: Array<ChessComRawGame[] | undefined> = new Array(total);
    let next = 0;
    let done = 0;
    let gameCount = 0;
    const workers = Math.max(1, Math.min(opts.concurrency ?? 2, total));
    let failure: unknown = null;

    // Delivers completed months in order, one at a time (a second caller returns at once
    // and the running pump picks its month up).
    let deliverAt = 0;
    let pumping = false;
    const pump = async () => {
      if (!opts.onMonth || pumping) return;
      pumping = true;
      try {
        while (deliverAt < total && results[deliverAt] !== undefined) {
          const i = deliverAt;
          const games = results[i]!;
          await opts.onMonth(monthOf(ordered[i]), games);
          results[i] = undefined;
          deliverAt++;
        }
      } finally {
        pumping = false;
      }
    };

    const run = async () => {
      while (next < total && !failure) {
        if (o.signal.aborted) throw abortError();
        const i = next++;
        try {
          const data = (await fetchJson(ordered[i], o)) as { games?: ChessComRawGame[] };
          const games = [...(data.games ?? [])].reverse();
          results[i] = games;
          done++;
          gameCount += games.length;
          opts.onProgress?.({ done, total, games: gameCount, month: monthOf(ordered[i]) });
          await pump();
        } catch (e) {
          if (!failure) failure = e;
          crawl.abort();
          throw e;
        }
      }
    };
    await Promise.allSettled(Array.from({ length: workers }, run));
    // Months that finished before the failure and are next in line still get delivered.
    if (incremental) await pump().catch((e) => (failure ??= e));
    if (opts.signal?.aborted) throw abortError();
    if (failure) throw failure;
    const newest = total ? monthOf(ordered[incremental ? total - 1 : 0]) : null;
    return { games: incremental ? [] : (results as ChessComRawGame[][]).flat(), lastMonth: newest };
  } finally {
    opts.signal?.removeEventListener("abort", onOuterAbort);
  }
}

/**
 * Parse one chess.com archive game into a Game. Returns null for missing PGN and for anything
 * that is not standard chess from the initial position (rules, initial_setup, SetUp/FEN, or
 * moves that do not replay legally).
 */
export function parseChessComGame(raw: ChessComRawGame, username: string): Game | null {
  if (!isStandardVariant(raw.rules)) return null;
  if (raw.initial_setup && !isStartFen(raw.initial_setup)) return null;
  const pgn = raw.pgn;
  if (!pgn) return null;
  const headers = parsePgnHeaders(pgn);
  if (!isStandardHeaders(headers)) return null;
  const moves = extractSanMoves(pgn);
  if (!isStandardPlay(moves, headers.Termination)) return null;
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
    moves,
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
