"use client";

import { useMemo } from "react";
import { Chess } from "chess.js";
import { useExplorerStore } from "@/lib/store";

export interface Position {
  /** moves up to the cursor */
  visible: string[];
  key: string;
  fen: string;
  turn: "w" | "b";
  lastMove: { from: string; to: string } | null;
}

export function usePosition(): Position {
  const path = useExplorerStore((s) => s.path);
  const cursor = useExplorerStore((s) => s.cursor);
  return useMemo(() => {
    const visible = path.slice(0, cursor);
    const chess = new Chess();
    let lastMove: Position["lastMove"] = null;
    for (const san of visible) {
      try {
        const m = chess.move(san);
        lastMove = { from: m.from, to: m.to };
      } catch {
        break;
      }
    }
    return { visible, key: visible.join(" "), fen: chess.fen(), turn: chess.turn(), lastMove };
  }, [path, cursor]);
}

/** Validate a SAN line, truncating at the first illegal move. */
export function validateLine(moves: string[]): string[] {
  const chess = new Chess();
  const ok: string[] = [];
  for (const san of moves) {
    try {
      chess.move(san);
      ok.push(san);
    } catch {
      break;
    }
  }
  return ok;
}
