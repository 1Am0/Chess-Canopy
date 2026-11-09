"use client";

import { useExplorerStore } from "@/lib/store";
import { ExplorerBoard } from "@/components/board/ExplorerBoard";
import { BoardControls } from "@/components/board/BoardControls";
import { ResultBar } from "@/components/board/ResultBar";
import { PlayerStrip } from "@/components/board/PlayerStrip";
import type { Color } from "@/lib/engine/types";

/**
 * Board + result bar + player strips + toolbar.
 *
 * Width contract: the parent sets `--board-size`. The board is exactly that wide;
 * the result bar (12px) + gap (8px) sit to its left, so the column's content
 * width is `calc(var(--board-size) + 20px)` (see BOARD_COLUMN_WIDTH).
 */
export const BOARD_COLUMN_WIDTH = "calc(var(--board-size) + 20px)";

export function BoardColumn() {
  const orientation = useExplorerStore((s) => s.orientation);
  const filterColor = useExplorerStore((s) => s.filters.color);
  const games = useExplorerStore((s) => s.result?.stats.total ?? 0);
  const side: Color = filterColor ?? orientation;
  const opp: Color = side === "white" ? "black" : "white";
  const bottomIsYou = orientation === side;

  return (
    <section aria-label="Board" className="flex flex-col gap-1.5" style={{ width: BOARD_COLUMN_WIDTH, maxWidth: "100%" }}>
      <div className="pl-5">
        <PlayerStrip you={!bottomIsYou} color={bottomIsYou ? opp : side} games={games} />
      </div>
      <div className="grid grid-cols-[12px_minmax(0,1fr)] gap-x-2">
        <ResultBar side={side} orientation={orientation} />
        <ExplorerBoard />
      </div>
      <div className="pl-5">
        <PlayerStrip you={bottomIsYou} color={bottomIsYou ? side : opp} games={games} />
      </div>
      <div className="pl-5">
        <BoardControls />
      </div>
    </section>
  );
}
