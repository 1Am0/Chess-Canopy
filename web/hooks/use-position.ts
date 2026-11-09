"use client";

import { useMemo, useSyncExternalStore } from "react";
import { openingsVersion, subscribeOpenings } from "@/lib/openings/lookup";
import { useExplorerStore } from "@/lib/store";
import { linePositions } from "@/lib/position-cache";

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
  // The opening names load in their own chunk. When they arrive, `visible` gets a new
  // identity so memoised `lookupOpening(visible)` calls in the components recompute.
  const openings = useSyncExternalStore(subscribeOpenings, openingsVersion, () => 0);
  return useMemo(() => {
    void openings;
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
  }, [path, cursor, openings]);
}
