"use client";

import { useMemo } from "react";
import { useExplorerStore } from "@/lib/store";
import { canonicalLine, linePositions } from "@/lib/position-cache";

export interface Position {
  /** moves up to the cursor */
  visible: string[];
  key: string;
  fen: string;
  turn: "w" | "b";
  lastMove: { from: string; to: string } | null;
}

/**
 * The position at the cursor. Every caller shares one incremental chess.js replay per line
 * (lib/position-cache.ts), so a move costs one chess.js move however many components ask.
 */
export function usePosition(): Position {
  const path = useExplorerStore((s) => s.path);
  const cursor = useExplorerStore((s) => s.cursor);
  return useMemo(() => {
    const lp = linePositions(path);
    const visible = path.slice(0, cursor);
    const at = Math.min(cursor, lp.sans.length);
    const fen = lp.fens[at];
    return {
      visible,
      key: visible.join(" "),
      fen,
      turn: fen.split(" ")[1] === "b" ? "b" : "w",
      lastMove: at > 0 ? lp.lastMoves[at - 1] : null,
    };
  }, [path, cursor]);
}

/** Validate a SAN line: the legal prefix, as chess.js SAN (so "Bxf7" becomes the stored "Bxf7+"). */
export function validateLine(moves: string[]): string[] {
  return canonicalLine(moves);
}
