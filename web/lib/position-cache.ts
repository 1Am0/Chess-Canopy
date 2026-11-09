/**
 * Main-thread position cache for the current line (C15). Seven components read the position
 * through `usePosition`; without this each replayed the whole line with chess.js on every
 * move (~15 ms at 30 plies, ~50 ms at 100). The cache is keyed by the `path` array identity
 * and extended incrementally from the longest common prefix of the previous line, so a
 * move or a cursor step costs at most one chess.js move.
 */
import { Chess } from "chess.js";

export interface LinePositions {
  /** chess.js SAN of the legal prefix of the line. */
  sans: string[];
  /** fens[i] = position after i moves; length sans.length + 1. */
  fens: string[];
  /** lastMoves[i] = from/to of move i (0-based). */
  lastMoves: Array<{ from: string; to: string }>;
}

const START = new Chess().fen();

let cached: { path: readonly string[]; lp: LinePositions; chess: Chess; at: number } | null = null;

function extend(path: readonly string[], lp: LinePositions, chess: Chess): void {
  for (let i = lp.sans.length; i < path.length; i++) {
    let m;
    try {
      m = chess.move(path[i]);
    } catch {
      return;
    }
    lp.sans.push(m.san);
    lp.fens.push(chess.fen());
    lp.lastMoves.push({ from: m.from, to: m.to });
  }
}

/** Positions along `path` (stops at the first illegal move). Cached; O(1) for the same array. */
export function linePositions(path: readonly string[]): LinePositions {
  if (cached && cached.path === path) return cached.lp;
  let k = 0;
  let base: LinePositions | null = null;
  let chess: Chess;
  if (cached) {
    const prev = cached.path;
    const max = Math.min(prev.length, path.length, cached.lp.sans.length);
    while (k < max && prev[k] === path[k]) k++;
    base = cached.lp;
  }
  const lp: LinePositions = {
    sans: base ? base.sans.slice(0, k) : [],
    fens: base ? base.fens.slice(0, k + 1) : [START],
    lastMoves: base ? base.lastMoves.slice(0, k) : [],
  };
  if (cached && k === cached.at) {
    chess = cached.chess; // the cached board sits exactly at the common prefix
  } else {
    chess = new Chess(lp.fens[k]);
  }
  extend(path, lp, chess);
  cached = { path, lp, chess, at: lp.sans.length };
  return lp;
}

/** The legal prefix of a SAN line as chess.js SAN ("Bxf7" -> "Bxf7+", "0-0" -> "O-O"). */
export function canonicalLine(moves: readonly string[]): string[] {
  const chess = new Chess();
  const out: string[] = [];
  for (const san of moves) {
    try {
      out.push(chess.move(san).san);
    } catch {
      break;
    }
  }
  return out;
}

/** chess.js SAN of `san` played in position `fen`, or null when it is not legal there. */
export function legalSan(fen: string, san: string): string | null {
  if (!san) return null;
  try {
    return new Chess(fen).move(san).san;
  } catch {
    return null;
  }
}

/** For tests: forget the cached line. */
export function resetPositionCache(): void {
  cached = null;
}
