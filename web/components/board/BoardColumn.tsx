"use client";

import { useExplorerStore } from "@/lib/store";
import { ExplorerBoard } from "@/components/board/ExplorerBoard";
import { BoardControls } from "@/components/board/BoardControls";
import { EvalBar } from "@/components/board/EvalBar";
import { PlayerStrip } from "@/components/board/PlayerStrip";
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
    // The board panel: a bordered panel (10px around everything, 8px on phones, border included) so the board keeps the size the layout asks for.
    <div className="relative z-10 mx-auto w-[var(--board-size)] max-w-full lg:mx-0 lg:w-[calc(var(--board-size)+1.25rem)]">
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-[7px] lg:p-[9px]" data-testid="board-mat">
      <div data-testid="strip-top" className="pl-10">
        <PlayerStrip you={!bottomIsYou} color={bottomIsYou ? opp : side} />
      </div>
      <div className="flex gap-2">
        <EvalBar />
        <div className="relative min-w-0 flex-1">
          <ExplorerBoard />
        </div>
      </div>
      <div data-testid="strip-bottom" className="pl-10">
        <PlayerStrip you={bottomIsYou} color={bottomIsYou ? side : opp} />
      </div>
      {/* indented to the board's edge, except on the narrowest phones where the two card strips need the full width to stay on one row */}
      <div className="pl-0 min-[360px]:pl-10">
        <BoardControls />
      </div>
    </div>
    </div>
  );
}
