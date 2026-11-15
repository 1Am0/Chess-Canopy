"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Compass, RotateCcw } from "lucide-react";
import { useRepertoirePage } from "@/lib/repertoire/page-store";
import type { Color } from "@/lib/engine/types";
import { EvalBar } from "@/components/board/EvalBar";
import { PlayerStrip } from "@/components/board/PlayerStrip";
import { PaperSheet, Tape, UnderSheet } from "@/components/paper";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { RepertoireBoard } from "@/components/repertoire/RepertoireBoard";
import { useBackToSelected, useHere } from "@/components/repertoire/here";

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// The explorer's board-control card buttons (BoardControls): 44px move buttons and 40px tool buttons on phones, 36px from
// sm, butted together like a ticket of cards.
const btn =
  "relative size-11 min-h-11 min-w-11 sm:size-9 sm:min-h-9 sm:min-w-9 rounded-none border-l-0 first:rounded-l-[2px] first:border-l last:rounded-r-[2px] hover:z-10 focus-visible:z-10";
const btnTool = "max-sm:size-10 max-sm:min-h-10 max-sm:min-w-10";
const group = "flex items-center";

/** "/?line=e4,e5&side=white": the explorer on this line and side. */
function explorerHref(line: readonly string[], side: Color): string {
  return `/?${line.length ? `line=${line.map(encodeURIComponent).join(",")}&` : ""}side=${side}`;
}

/** The explorer's BoardControls layout, bound to the Repertoire page's line. */
function RepertoireControls() {
  const { at, sans, visible, side } = useHere();
  const reset = useRepertoirePage((s) => s.reset);
  const back = useRepertoirePage((s) => s.back);
  const forward = useRepertoirePage((s) => s.forward);
  const toEnd = useRepertoirePage((s) => s.toEnd);
  const backToSelected = useBackToSelected();
  const atStart = at === 0;
  const atEnd = at >= sans.length;

  return (
    <div role="group" aria-label="Board controls" className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
      <div className={group}>
        <Tip label="Start">
          <Button variant="outline" size="icon" className={btn} onClick={reset} disabled={atStart} aria-label="Go to start">
            <ChevronsLeft />
          </Button>
        </Tip>
        <Tip label="Previous move">
          <Button variant="outline" size="icon" className={btn} onClick={back} disabled={atStart} aria-label="Previous move">
            <ChevronLeft />
          </Button>
        </Tip>
        <Tip label="Next move">
          <Button variant="outline" size="icon" className={btn} onClick={forward} disabled={atEnd} aria-label="Next move">
            <ChevronRight />
          </Button>
        </Tip>
        <Tip label="End">
          <Button variant="outline" size="icon" className={btn} onClick={toEnd} disabled={atEnd} aria-label="Go to end">
            <ChevronsRight />
          </Button>
        </Tip>
      </div>
      <div className={group}>
        <Tip label="Open in explorer">
          <Button asChild variant="outline" size="icon" className={cn(btn, btnTool)}>
            <Link href={explorerHref(visible, side)} aria-label="Open in explorer">
              <Compass />
            </Link>
          </Button>
        </Tip>
        <Tip label="Back to the selected position">
          <Button variant="outline" size="icon" className={cn(btn, btnTool)} onClick={backToSelected} aria-label="Back to the selected position">
            <RotateCcw />
          </Button>
        </Tip>
      </div>
    </div>
  );
}

/**
 * The explorer's BoardColumn for the Repertoire page: the same mat, strips, eval bar and toolbar around the Repertoire
 * board, so the board has exactly the explorer's size. The board is always seen from your side.
 */
export function RepertoireBoardColumn() {
  const { side, fen, point, locked } = useHere();
  const opp: Color = side === "white" ? "black" : "white";

  return (
    <div
      id="repertoire-board"
      className="relative isolate z-10 mx-auto w-[var(--board-size)] max-w-full scroll-mt-16 lg:mx-0 lg:w-[calc(var(--board-size)+1.25rem)]"
    >
      <UnderSheet seed={5} dx={5} dy={6} rotate={0.7} />
      <PaperSheet className="flex flex-col gap-2 p-2 lg:p-2.5" data-testid="board-mat">
        <Tape variant="sage" angle={-3} seed="mat-l" className="hidden lg:block -top-1.5 left-5" />
        <Tape variant="sage" angle={3} seed="mat-r" className="hidden lg:block -top-1.5 right-5" />
        <div data-testid="strip-top" className="pl-10 max-sm:hidden">
          <PlayerStrip you={false} color={opp} />
        </div>
        <div className="flex gap-2">
          <EvalBar fen={fen} orientation={side} />
          {/* the print */}
          <div className="relative min-w-0 flex-1 shadow-print">
            <RepertoireBoard side={side} moves={point?.moves ?? []} locked={locked} />
          </div>
        </div>
        <div data-testid="strip-bottom" className="pl-10">
          <PlayerStrip you color={side} />
        </div>
        <div className="pl-0 sm:pl-10">
          <RepertoireControls />
        </div>
      </PaperSheet>
    </div>
  );
}
