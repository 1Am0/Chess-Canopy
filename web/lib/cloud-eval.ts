/** Lichess cloud evaluation (https://lichess.org/api/cloud-eval): cached Stockfish results, no auth. */

export interface CloudEval {
  /** centipawns from White's point of view (when `mate` is null) */
  cp: number | null;
  /** moves to mate, positive = White mates (null when not a mate score) */
  mate: number | null;
  depth: number;
  /** Where the number came from; absent means the Lichess cloud cache. */
  source?: "local";
}

export type EvalResult = { status: "ok"; eval: CloudEval } | { status: "none" } | { status: "error" };

const cache = new Map<string, EvalResult>();
let pausedUntil = 0;

/** Parse the API response body; null when it has no usable principal variation. */
export function parseCloudEval(body: unknown): CloudEval | null {
  const b = body as { depth?: unknown; pvs?: { cp?: unknown; mate?: unknown }[] } | null;
  const pv = b?.pvs?.[0];
  if (!pv) return null;
  const depth = typeof b?.depth === "number" ? b.depth : 0;
  if (typeof pv.mate === "number") return { cp: null, mate: pv.mate, depth };
  if (typeof pv.cp === "number") return { cp: pv.cp, mate: null, depth };
  return null;
}

/** White's share of the bar, 0..100 (Lichess's winning-chances curve). */
export function whiteShare(e: CloudEval): number {
  if (e.mate !== null) return e.mate > 0 ? 100 : e.mate < 0 ? 0 : 50;
  const cp = Math.max(-1000, Math.min(1000, e.cp ?? 0));
  return 50 + 50 * ((2 / (1 + Math.exp(-0.00368208 * cp))) - 1);
}

/** "+0.3", "-1.2", "M3", "-M2" */
export function formatEval(e: CloudEval): string {
  if (e.mate !== null) return e.mate === 0 ? "0" : `${e.mate < 0 ? "-" : ""}M${Math.abs(e.mate)}`;
  const v = (e.cp ?? 0) / 100;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}

export async function fetchCloudEval(fen: string, signal?: AbortSignal): Promise<EvalResult> {
  const hit = cache.get(fen);
  if (hit && hit.status !== "error") return hit;
  if (Date.now() < pausedUntil) return { status: "error" };
  try {
    const r = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`, { signal });
    let res: EvalResult;
    if (r.status === 404) res = { status: "none" };
    else if (r.status === 429) {
      pausedUntil = Date.now() + 60_000; // Lichess asked us to slow down
      return { status: "error" };
    } else if (!r.ok) return { status: "error" };
    else {
      const e = parseCloudEval(await r.json());
      res = e ? { status: "ok", eval: e } : { status: "none" };
    }
    cache.set(fen, res);
    return res;
  } catch {
    return { status: "error" };
  }
}
