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
  run(report: RepertoireReport, onPoint: (pe: PointEval) => void, signal: AbortSignal): Promise<void>;
}

const defaultDeps: EvalQueueDeps = {
  cloud: fetchCloudEval,
  local: evalLocal,
  localAvailable: localEvalAvailable,
  cache: { get: getCachedEvals, put: putCachedEval },
};

interface Job {
  point: DecisionPoint;
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
    async run(report, onPoint, signal) {
      if (signal.aborted) return;
      const jobs: Job[] = [];
      const order: string[] = []; // normalised FENs, first use first
      const raw = new Map<string, string>(); // normalised -> a full FEN to query with
      const users = new Map<string, Job[]>();
      for (const point of report.points) {
        const moves = movesToEvaluate(point);
        const job: Job = { point, moves, fens: [] };
        for (const fen of [point.fen, ...moves.map((m) => m.fenAfter)]) {
          const key = normFen(fen);
          if (job.fens.includes(key)) continue;
          job.fens.push(key);
          if (!raw.has(key)) {
            raw.set(key, fen);
            order.push(key);
            users.set(key, []);
          }
          users.get(key)!.push(job);
        }
        jobs.push(job);
      }

      const known = new Map<string, CloudEval>();
      try {
        for (const [fen, e] of await deps.cache.get(order)) known.set(normFen(fen), e);
      } catch {
        // a cache failure is a miss
      }
      if (signal.aborted) return;
      for (const job of jobs) {
        if (job.fens.every((f) => known.has(f))) onPoint(buildPointEval(job, known, report.side));
      }

      const todo = order.filter((f) => !known.has(f)).slice(0, MAX_FENS_PER_RUN);
      for (const key of todo) {
        if (signal.aborted) return;
        const fen = raw.get(key)!;
        let result: CloudEval | null = null;
        const res: EvalResult = await deps.cloud(fen, signal).catch(() => ({ status: "error" }) as const);
        if (signal.aborted) return;
        if (res.status === "ok") result = res.eval;
        else if (deps.localAvailable()) {
          const local = await deps.local(fen, { signal }).catch(() => null);
          if (local) result = { ...local, source: "local" };
        }
        if (signal.aborted) return;
        if (result) {
          known.set(key, result);
          try {
            await deps.cache.put(fen, result);
          } catch {
            // not cached
          }
        }
        for (const job of users.get(key) ?? []) onPoint(buildPointEval(job, known, report.side));
      }
    },
  };
}
