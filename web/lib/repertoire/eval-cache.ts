/**
 * Persistent engine-eval cache for the Repertoire page, so coming back to the page does not query hundreds of
 * positions again. Its own small database; every failure (no IndexedDB, quota, ...) behaves as a cache miss.
 */
import Dexie, { type Table } from "dexie";
import type { CloudEval } from "../cloud-eval";

interface EvalRow {
  fen: string;
  eval: CloudEval;
  at: number;
}

const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

class EvalDB extends Dexie {
  evals!: Table<EvalRow, string>;
  constructor() {
    super("chess-canopy-evals");
    this.version(1).stores({ evals: "&fen" });
  }
}

let db: EvalDB | null = null;
function getDb(): EvalDB | null {
  if (typeof indexedDB === "undefined") return null;
  try {
    db ??= new EvalDB();
    return db;
  } catch {
    return null;
  }
}

/** The FEN with its halfmove / fullmove counters set to "0 1" (the cache key). */
export function normFen(fen: string): string {
  return `${fen.trim().split(/\s+/).slice(0, 4).join(" ")} 0 1`;
}

/** Cached evals for `fens`, keyed by the FEN strings as given; missing and expired ones are left out. */
export async function getCachedEvals(fens: string[]): Promise<Map<string, CloudEval>> {
  const out = new Map<string, CloudEval>();
  const d = getDb();
  if (!d || fens.length === 0) return out;
  try {
    const rows = await d.evals.bulkGet(fens.map(normFen));
    const cutoff = Date.now() - MAX_AGE_MS;
    rows.forEach((row, i) => {
      if (row && row.at >= cutoff) out.set(fens[i], row.eval);
    });
  } catch {
    // behave as a miss
  }
  return out;
}

export async function putCachedEval(fen: string, e: CloudEval): Promise<void> {
  const d = getDb();
  if (!d) return;
  try {
    await d.evals.put({ fen: normFen(fen), eval: e, at: Date.now() });
  } catch {
    // not cached, never mind
  }
}
