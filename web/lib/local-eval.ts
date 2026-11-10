/**
 * In-browser Stockfish (lite, single-threaded WASM) used when Lichess's cloud cache has no evaluation for a
 * position. The engine lives in a Web Worker served from /stockfish/, is created on first use, searches one
 * position at a time and is shut down again after a minute of inactivity.
 */
import type { CloudEval } from "@/lib/cloud-eval";

export const ENGINE_URL = "/stockfish/stockfish-19-lite-single.js";
const DEFAULT_DEPTH = 14;
const DEFAULT_MOVETIME_MS = 2500;
const IDLE_MS = 60_000;
/** Progress is reported from this depth on; shallower scores jump around too much to show. */
const MIN_REPORT_DEPTH = 6;

export interface EngineHandle {
  post(cmd: string): void;
  terminate(): void;
}
export type EngineFactory = (onLine: (line: string) => void, onFail: () => void) => EngineHandle;

/** Score of a UCI `info` line, converted from the side to move to White's point of view. Null if it has no usable score. */
export function parseInfoScore(line: string, whiteToMove: boolean): CloudEval | null {
  if (!line.startsWith("info ") || / (?:lower|upper)bound\b/.test(line)) return null;
  const depth = /\bdepth (\d+)/.exec(line);
  const score = /\bscore (cp|mate) (-?\d+)/.exec(line);
  if (!depth || !score) return null;
  const sign = whiteToMove ? 1 : -1;
  const n = Number(score[2]);
  if (score[1] === "cp") return { cp: n * sign, mate: null, depth: Number(depth[1]) };
  // "mate 0" is how the engine reports being checkmated; show it as a decisive score for the other side
  if (n === 0) return { cp: -sign * 1000, mate: null, depth: Number(depth[1]) };
  return { cp: null, mate: n * sign, depth: Number(depth[1]) };
}

interface Job {
  fen: string;
  whiteToMove: boolean;
  depth: number;
  movetime: number;
  onProgress?: (e: CloudEval) => void;
  resolve: (e: CloudEval | null) => void;
  last: CloudEval | null;
  aborted: boolean;
}

const cache = new Map<string, CloudEval>();
let factory: EngineFactory = defaultFactory;
let handle: EngineHandle | null = null;
let ready: Promise<boolean> | null = null;
let readyResolve: ((ok: boolean) => void) | null = null;
let broken = false;
let running: Job | null = null;
let queue: Job[] = [];
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function defaultFactory(onLine: (line: string) => void, onFail: () => void): EngineHandle {
  const w = new Worker(ENGINE_URL);
  w.onmessage = (ev: MessageEvent) => {
    if (typeof ev.data === "string") onLine(ev.data);
  };
  w.onerror = onFail;
  return { post: (cmd) => w.postMessage(cmd), terminate: () => w.terminate() };
}

/** Test hook: swap the worker for a fake engine and reset all module state. */
export function __setEngineFactory(f: EngineFactory | null) {
  shutdown();
  factory = f ?? defaultFactory;
  broken = false;
  cache.clear();
}

function shutdown() {
  clearTimeout(idleTimer);
  handle?.terminate();
  handle = null;
  ready = null;
  readyResolve = null;
  const orphans = [...(running ? [running] : []), ...queue];
  running = null;
  queue = [];
  for (const j of orphans) j.resolve(null);
}

function fail() {
  broken = true;
  shutdown();
}

function onLine(line: string) {
  if (line === "uciok") handle?.post("isready");
  else if (line === "readyok") readyResolve?.(true);
  else if (running && line.startsWith("info ")) {
    const e = parseInfoScore(line, running.whiteToMove);
    if (!e) return;
    running.last = e;
    if (!running.aborted && e.depth >= MIN_REPORT_DEPTH) running.onProgress?.(e);
  } else if (running && line.startsWith("bestmove")) {
    const job = running;
    running = null;
    const result = job.aborted ? null : job.last;
    if (result) cache.set(job.fen, result);
    job.resolve(result);
    next();
  }
}

function ensureEngine(): Promise<boolean> {
  if (broken) return Promise.resolve(false);
  if (ready) return ready;
  ready = new Promise<boolean>((resolve) => {
    readyResolve = resolve;
    try {
      handle = factory(onLine, fail);
      handle.post("uci");
    } catch {
      fail();
      resolve(false);
    }
  }).then((ok) => {
    if (ok) handle?.post("setoption name Hash value 32");
    return ok;
  });
  return ready;
}

function next() {
  clearTimeout(idleTimer);
  if (running) return;
  const job = queue.pop(); // only the newest request matters; older ones were superseded
  for (const old of queue.splice(0)) old.resolve(null);
  if (!job) {
    idleTimer = setTimeout(shutdown, IDLE_MS);
    return;
  }
  running = job;
  void ensureEngine().then((ok) => {
    if (!ok || !handle) {
      if (running === job) running = null;
      job.resolve(null);
      return;
    }
    if (job.aborted) {
      // aborted while the engine was starting: nothing was sent, so just move on
      running = null;
      job.resolve(null);
      next();
      return;
    }
    handle.post(`position fen ${job.fen}`);
    handle.post(`go depth ${job.depth} movetime ${job.movetime}`);
  });
}

export interface LocalEvalOptions {
  signal?: AbortSignal;
  depth?: number;
  movetime?: number;
  /** Called with a deeper score as the search progresses. */
  onProgress?: (e: CloudEval) => void;
}

export function localEvalAvailable(): boolean {
  return !broken && (factory !== defaultFactory || (typeof Worker !== "undefined" && typeof WebAssembly !== "undefined"));
}

/** Evaluate `fen` with the local engine; resolves null if aborted, superseded or the engine is unavailable. */
export function evalLocal(fen: string, opts: LocalEvalOptions = {}): Promise<CloudEval | null> {
  const hit = cache.get(fen);
  if (hit) return Promise.resolve(hit);
  if (!localEvalAvailable() || opts.signal?.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    const job: Job = {
      fen,
      whiteToMove: fen.split(" ")[1] !== "b",
      depth: opts.depth ?? DEFAULT_DEPTH,
      movetime: opts.movetime ?? DEFAULT_MOVETIME_MS,
      onProgress: opts.onProgress,
      resolve,
      last: null,
      aborted: false,
    };
    opts.signal?.addEventListener(
      "abort",
      () => {
        job.aborted = true;
        const queued = queue.indexOf(job);
        if (queued >= 0) {
          queue.splice(queued, 1);
          resolve(null);
        } else if (running === job && handle) handle.post("stop");
      },
      { once: true },
    );
    queue.push(job);
    next();
  });
}
