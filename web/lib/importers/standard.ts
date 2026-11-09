/**
 * "Is this standard chess from the initial position?" checks shared by every importer
 * (and by the one-time DB cleanup). Mirrors the Python CLI's is_standard_headers /
 * is_standard_record, plus a full legality replay of the moves, which also catches
 * variants whose metadata was lost (crazyhouse drops, chess960 castling, King of the
 * Hill / Three-check wins written as mate).
 */
import { replayCheck } from "../engine/legal";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const START_PLACEMENT = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
const STANDARD_VARIANTS = new Set(["", "standard", "chess"]);

/** chess.com termination texts of variant wins ("won by checking the opponent king for the 3rd time"). */
const VARIANT_TERMINATION = /checking the opponent king for the \w+ time|king reaching the hill|three-?check|king of the hill/i;

/** Initial position, like Python `_is_start_fen`: piece placement and White to move. */
export function isStartFen(fen: string | null | undefined): boolean {
  const parts = String(fen ?? "").trim().split(/\s+/);
  return parts.length >= 2 && parts[0] === START_PLACEMENT && parts[1] === "w";
}

/** A `Variant` header / Lichess `variant` / chess.com `rules` value that means standard chess. */
export function isStandardVariant(v: unknown): boolean {
  if (v == null) return true;
  return STANDARD_VARIANTS.has(String(v).trim().toLowerCase());
}

/** PGN headers: Variant, SetUp and FEN (port of Python is_standard_headers). */
export function isStandardHeaders(h: Record<string, string | undefined>): boolean {
  if (!isStandardVariant(h.Variant)) return false;
  if ((h.SetUp ?? "").trim() === "1") return false;
  const fen = (h.FEN ?? "").trim();
  return !fen || isStartFen(fen);
}

/** Moves + termination: legal standard chess, no drops, no variant win text. */
export function isStandardPlay(moves: readonly string[], termination?: string | null): boolean {
  if (termination && VARIANT_TERMINATION.test(termination)) return false;
  for (const m of moves) if (m.includes("@")) return false;
  const r = replayCheck(moves);
  return r.legal && !r.badMarks;
}
