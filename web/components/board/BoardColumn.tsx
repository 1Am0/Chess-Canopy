"use client";

import { useExplorerStore } from "@/lib/store";
import { ExplorerBoard } from "@/components/board/ExplorerBoard";
import { BoardControls } from "@/components/board/BoardControls";
import { EvalBar } from "@/components/board/EvalBar";
import { PlayerStrip } from "@/components/board/PlayerStrip";
import { PaperSheet, PhotoCorners } from "@/components/paper";
import type { Color } from "@/lib/engine/types";

/**
 * Board + player strips + toolbar.
 *
 * Width contract: the parent sets `--board-size`; the column (board, strips and
 * toolbar) is exactly that wide.
 */
export const BOARD_COLUMN_WIDTH = "var(--board-size)";

export function BoardColumn() {
  const orientation = useExplorerStore((s) => s.orientation);
  const filterColor = useExplorerStore((s) => s.filters.color);
  const side: Color = filterColor ?? orientation;
  const opp: Color = side === "white" ? "black" : "white";
  const bottomIsYou = orientation === side;

  return (
    // The print on its mat: a cream mount (12px of paper around everything, 8px on phones). The mat is
    // as wide as the board column plus its own padding, so the board keeps the size the layout asks for.
    <PaperSheet
      className="mx-auto flex w-[var(--board-size)] max-w-full flex-col gap-1.5 p-2 lg:mx-0 lg:w-[calc(var(--board-size)+1.5rem)] lg:p-3"
      data-testid="board-mat"
    >
      <div data-testid="strip-top" className="pl-8">
        <PlayerStrip you={!bottomIsYou} color={bottomIsYou ? opp : side} />
      </div>
      <div className="flex gap-1">
        <EvalBar />
        {/* the print, held by four photo corners */}
        <div className="relative min-w-0 flex-1 shadow-print">
          <ExplorerBoard />
          <PhotoCorners />
        </div>
      </div>
      <div data-testid="strip-bottom" className="pl-8">
        <PlayerStrip you={bottomIsYou} color={bottomIsYou ? side : opp} />
      </div>
      <div className="pl-8">
        <BoardControls />
      </div>
    </PaperSheet>
  );
}
