/**
 * Fetches the engine evals a RepertoireReport needs: persistent cache first, then one position at a time from the
 * Lichess cloud cache, falling back to the local engine. Emits a PointEval whenever a point's evals change.
 */
import { fetchCloudEval, type CloudEval, type EvalResult } from "../cloud-eval";
import { evalLocal, localEvalAvailable, type LocalEvalOptions } from "../local-eval";
import { getCachedEvals, normFen, putCachedEval } from "./eval-cache";
import type { DecisionPoint, MoveEval, MoveUsage, PointEval, RepertoireReport } from "./types";
import { moveEval, movesToEvaluate, statusOf } from "./verdict";
import type { Color } from "../engine/types";

/** At most this many positions are sent to the engine per run (cache hits do not count). */
export const MAX_FENS_PER_RUN = 400;

export interface EvalQueueDeps {
  cloud: (fen: string, signal?: AbortSignal) => Promise<EvalResult>;
  local: (fen: string, opts?: LocalEvalOptions) => Promise<CloudEval | null>;
  localAvailable: () => boolean;
  cache: {
    get: (fens: string[]) => Promise<Map<string, CloudEval>>;
    put: (fen: string, e: CloudEval) => Promise<void>;
  };
}

export interface EvalQueue {
  /**
   * Evaluates the points of one report, or of several (e.g. White's then Black's): in order, each report's positions
   * capped at MAX_FENS_PER_RUN.
   */
  run(reports: RepertoireReport | RepertoireReport[], onPoint: (pe: PointEval) => void, signal: AbortSignal): Promise<void>;
}

/** A tiny async FIFO: `take` waits for the next item, or resolves null once `close` was called and it is empty. */
function channel<T>() {
  const items: T[] = [];
  let wake: (() => void) | null = null;
  let closed = false;
  return {
    push(item: T) {
      items.push(item);
      wake?.();
    },
    close() {
      closed = true;
      wake?.();
    },
    async take(): Promise<T | null> {
      while (items.length === 0 && !closed) await new Promise<void>((r) => (wake = r));
      wake = null;
      return items.length ? items.shift()! : null;
    },
  };
}

/**
 * Browser Stockfish settings for positions Lichess has no cloud eval for: search to depth 18, giving up after 6 s
 * (whichever comes first).
 */
export const LOCAL_DEPTH = 18;
export const LOCAL_MOVETIME_MS = 6000;
/**
 * Saved local evals below this depth come from the old depth-14 setting and are searched again. (A search that hit the
 * time limit before depth 18 is kept: redoing it would take just as long and stop at about the same depth.)
 */
export const LOCAL_REDO_BELOW = 15;

const defaultDeps: EvalQueueDeps = {
  cloud: fetchCloudEval,
  local: evalLocal,
  localAvailable: localEvalAvailable,
  cache: { get: getCachedEvals, put: putCachedEval },
};

interface Job {
  point: DecisionPoint;
  side: Color;
  moves: MoveUsage[];
  /** Normalised FENs this point needs. */
  fens: string[];
}

function buildPointEval(job: Job, known: Map<string, CloudEval>, side: Color): PointEval {
  const before = known.get(normFen(job.point.fen)) ?? null;
  const moves: Record<string, MoveEval> = {};
  for (const m of job.moves) {
    const after = known.get(normFen(m.fenAfter)) ?? null;
    moves[m.san] =
      before && after ? moveEval(m.san, before, after, side) : { san: m.san, after, lossCp: null, verdict: "unknown" };
  }
  return { epd: job.point.epd, before, moves, status: statusOf(job.point, { before, moves }) };
}

export function createEvalQueue(deps: EvalQueueDeps = defaultDeps): EvalQueue {
  return {
    async run(input, onPoint, signal) {
      if (signal.aborted) return;
      const reports = Array.isArray(input) ? input : [input];
      const jobs: Job[] = [];
      const order: string[] = []; // normalised FENs, first use first
      const raw = new Map<string, string>(); // normalised -> a full FEN to query with
      const users = new Map<string, Job[]>();
      /** Per report, the positions first needed by that report (in order). */
      const segments: string[][] = [];
      for (const report of reports) {
        const fresh: string[] = [];
        for (const point of report.points) {
          const moves = movesToEvaluate(point);
          const job: Job = { point, side: report.side, moves, fens: [] };
          for (const fen of [point.fen, ...moves.map((m) => m.fenAfter)]) {
            const key = normFen(fen);
            if (job.fens.includes(key)) continue;
            job.fens.push(key);
            if (!raw.has(key)) {
              raw.set(key, fen);
              order.push(key);
              fresh.push(key);
              users.set(key, []);
            }
            users.get(key)!.push(job);
          }
          jobs.push(job);
        }
        segments.push(fresh);
      }

      const known = new Map<string, CloudEval>();
      try {
        for (const [fen, e] of await deps.cache.get(order)) {
          // a local eval saved by the earlier, shallower setting is redone at LOCAL_DEPTH
          if (e.source === "local" && e.depth < LOCAL_REDO_BELOW) continue;
          known.set(normFen(fen), e);
        }
      } catch {
        // a cache failure is a miss
      }
      if (signal.aborted) return;
      for (const job of jobs) {
        if (job.fens.every((f) => known.has(f))) onPoint(buildPointEval(job, known, job.side));
      }

      // Positions that still need the engine, report by report, at most MAX_FENS_PER_RUN per report.
      const work = segments.flatMap((seg) => seg.filter((k) => !known.has(k)).slice(0, MAX_FENS_PER_RUN));

      const settle = async (key: string, result: CloudEval | null) => {
        if (result) {
          known.set(key, result);
          try {
            await deps.cache.put(raw.get(key)!, result);
          } catch {
            // not cached
          }
        }
        if (signal.aborted) return;
        for (const job of users.get(key) ?? []) onPoint(buildPointEval(job, known, job.side));
      };

      // Two lanes side by side: Lichess answers the positions it has (one request at a time), and the positions it
      // has not go to the browser engine, which works through them meanwhile instead of holding up the cloud lane.
      const toLocal = channel<string>();
      const useLocal = deps.localAvailable();
      const cloudLane = (async () => {
        try {
          for (const key of work) {
            if (signal.aborted) return;
            const res: EvalResult = await deps.cloud(raw.get(key)!, signal).catch(() => ({ status: "error" }) as const);
            if (signal.aborted) return;
            if (res.status === "ok") await settle(key, res.eval);
            else if (useLocal) toLocal.push(key);
            else await settle(key, null);
          }
        } finally {
          toLocal.close();
        }
      })();
      const localLane = (async () => {
        for (let key = await toLocal.take(); key !== null; key = await toLocal.take()) {
          if (signal.aborted) continue; // drain without work
          const local = await deps.local(raw.get(key)!, { signal, depth: LOCAL_DEPTH, movetime: LOCAL_MOVETIME_MS }).catch(() => null);
          if (signal.aborted) continue;
          await settle(key, local ? { ...local, source: "local" } : null);
        }
      })();
      await Promise.all([cloudLane, localLane]);
    },
  };
}
