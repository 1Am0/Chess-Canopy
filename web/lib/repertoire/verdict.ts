/** Engine verdicts for the Repertoire page: pure functions, no I/O. */
import { Chess } from "chess.js";
import type { CloudEval } from "../cloud-eval";
import type { Color } from "../engine/types";
import {
  BAD_CP,
  CONSISTENT_SHARE,
  DUBIOUS_CP,
  EVAL_MIN_MOVE_GAMES,
  type DecisionPoint,
  type MoveEval,
  type MoveUsage,
  type PointEval,
  type PointStatus,
  type Verdict,
} from "./types";

/** A move with at least this share of the games counts for the "problem" / "undecided" decision. */
const RELEVANT_SHARE = 0.2;
const CP_CLAMP = 1000;
const MAX_LOSS = 2000;

/** White-POV centipawns. Mate scores become ±(10000 − |mate|·10); plain scores are clamped to ±1000. */
export function evalToCp(e: CloudEval): number {
  if (e.mate !== null) {
    if (e.mate === 0) return 0;
    return Math.sign(e.mate) * (10000 - Math.abs(e.mate) * 10);
  }
  return Math.max(-CP_CLAMP, Math.min(CP_CLAMP, e.cp ?? 0));
}

/** Centipawns `side` lost by going from `before` to `after` (>= 0, at most 2000). */
export function lossCp(before: CloudEval, after: CloudEval, side: Color): number {
  const pov = (e: CloudEval) => (side === "white" ? evalToCp(e) : -evalToCp(e));
  return Math.min(MAX_LOSS, Math.max(0, pov(before) - pov(after)));
}

export function verdictOf(loss: number | null): Verdict {
  if (loss === null) return "unknown";
  if (loss < DUBIOUS_CP) return "good";
  if (loss < BAD_CP) return "dubious";
  return "bad";
}

export function moveEval(san: string, before: CloudEval, after: CloudEval, side: Color): MoveEval {
  const loss = lossCp(before, after, side);
  return { san, after, lossCp: loss, verdict: verdictOf(loss) };
}

const isBad = (v: Verdict) => v === "dubious" || v === "bad";

/** See PointStatus in ./types. */
export function statusOf(
  point: DecisionPoint,
  ev: { before: CloudEval | null; moves: Record<string, MoveEval> } | undefined,
): PointStatus {
  const verdict = (san: string): Verdict => ev?.moves[san]?.verdict ?? "unknown";
  const mainVerdict = verdict(point.main);
  if (point.consistency >= CONSISTENT_SHARE) {
    if (mainVerdict === "good") return "settled";
    if (isBad(mainVerdict)) return "leaking";
    return "pending";
  }
  // MoveUsage has no per-period counts, so shares are taken over all games (also when there is a switch).
  // Only moves that are sent to the engine can ever get a verdict, so only those count; otherwise a move played
  // once in three games would keep the point pending forever.
  const evaluated = new Set(movesToEvaluate(point).map((m) => m.san));
  const relevant = point.moves
    .filter((m) => point.games > 0 && m.games / point.games >= RELEVANT_SHARE && evaluated.has(m.san))
    .map((m) => m.san);
  if (relevant.some((san) => isBad(verdict(san)))) return "problem";
  // the main move is judged too, so a point never turns "undecided" before its main move has a verdict
  if ([...relevant, point.main].every((san) => verdict(san) === "good")) return "undecided";
  return "pending";
}

/**
 * Moves sent to the engine: those played at least EVAL_MIN_MOVE_GAMES times, plus the main move and the most-played
 * move always, plus the locked move (with zero counts) when it was never played here.
 */
export function movesToEvaluate(point: DecisionPoint): MoveUsage[] {
  const out: MoveUsage[] = [];
  const seen = new Set<string>();
  const add = (m: MoveUsage | undefined) => {
    if (!m || seen.has(m.san)) return;
    seen.add(m.san);
    out.push(m);
  };
  add(point.moves[0]);
  add(point.moves.find((m) => m.san === point.main));
  for (const m of point.moves) if (m.games >= EVAL_MIN_MOVE_GAMES) add(m);
  if (point.locked && !seen.has(point.locked)) {
    const fenAfter = fenAfterMove(point.fen, point.locked);
    if (fenAfter) {
      add({ san: point.locked, games: 0, wins: 0, draws: 0, losses: 0, firstDate: "", lastDate: "", fenAfter });
    }
  }
  return out;
}

function fenAfterMove(fen: string, san: string): string | null {
  try {
    const c = new Chess(fen);
    c.move(san);
    return c.fen();
  } catch {
    return null;
  }
}

export const STATUS_ORDER: PointStatus[] = ["problem", "leaking", "undecided", "pending", "settled"];

/** Problems first, then by priority desc, then games desc; stable otherwise. Points without an eval count as pending. */
export function sortForDisplay(points: DecisionPoint[], evals: Map<string, PointEval>): DecisionPoint[] {
  const rank = (p: DecisionPoint) => STATUS_ORDER.indexOf(evals.get(p.epd)?.status ?? statusOf(p, undefined));
  return points
    .map((p, i) => ({ p, i, r: rank(p) }))
    .sort((a, b) => a.r - b.r || b.p.priority - a.p.priority || b.p.games - a.p.games || a.i - b.i)
    .map((x) => x.p);
}
