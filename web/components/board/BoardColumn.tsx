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
    <div className="mx-auto flex flex-col gap-1.5 lg:mx-0" style={{ width: BOARD_COLUMN_WIDTH, maxWidth: "100%" }}>
      <div data-testid="strip-top" className="pl-7">
        <PlayerStrip you={!bottomIsYou} color={bottomIsYou ? opp : side} />
      </div>
      <div className="flex gap-1">
        <EvalBar />
        <div className="min-w-0 flex-1">
          <ExplorerBoard />
        </div>
      </div>
      <div data-testid="strip-bottom" className="pl-7">
        <PlayerStrip you={bottomIsYou} color={bottomIsYou ? side : opp} />
      </div>
      <div className="pl-7">
        <BoardControls />
      </div>
    </div>
  );
}
