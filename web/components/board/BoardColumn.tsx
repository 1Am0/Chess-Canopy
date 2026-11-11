"use client";

import { useExplorerStore } from "@/lib/store";
import { ExplorerBoard } from "@/components/board/ExplorerBoard";
import { BoardControls } from "@/components/board/BoardControls";
import { EvalBar } from "@/components/board/EvalBar";
import { PlayerStrip } from "@/components/board/PlayerStrip";
import { PaperSheet, PhotoCorners, Tape, UnderSheet } from "@/components/paper";
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
    // The print on its mat: a cream mount (10px of paper around everything, 8px on phones) taped to the desk
    // with two strips, over a second mount peeking out. The wrapper is as wide as the board column plus the mat's
    // padding, so the board keeps the size the layout asks for.
    <div className="relative isolate z-10 mx-auto w-[var(--board-size)] max-w-full lg:mx-0 lg:w-[calc(var(--board-size)+1.25rem)]">
    <UnderSheet seed={5} dx={5} dy={6} rotate={0.7} />
    <PaperSheet className="flex flex-col gap-1.5 p-2 lg:p-2.5" data-testid="board-mat">
      <Tape variant="sage" angle={-3} seed="mat-l" className="-top-1.5 left-5" />
      <Tape variant="sage" angle={3} seed="mat-r" className="-top-1.5 right-5" />
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
      {/* indented to the board's edge, except on the narrowest phones where the two card strips need the full width to stay on one row */}
      <div className="pl-0 min-[360px]:pl-8">
        <BoardControls />
      </div>
    </PaperSheet>
    </div>
  );
}
