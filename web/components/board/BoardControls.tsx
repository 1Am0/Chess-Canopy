"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FlipVertical2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExplorerStore } from "@/lib/store";

export function BoardControls() {
  const cursor = useExplorerStore((s) => s.cursor);
  const pathLength = useExplorerStore((s) => s.path.length);
  const toStart = useExplorerStore((s) => s.toStart);
  const undo = useExplorerStore((s) => s.undo);
  const redo = useExplorerStore((s) => s.redo);
  const toEnd = useExplorerStore((s) => s.toEnd);
  const flip = useExplorerStore((s) => s.flip);
  const atStart = cursor === 0;
  const atEnd = cursor >= pathLength;
  return (
    <div role="toolbar" aria-label="Board controls" className="flex items-center justify-center gap-1">
      <Button variant="outline" size="icon" onClick={toStart} disabled={atStart} aria-label="Go to start (↑)" title="Start (↑)">
        <ChevronsLeft />
      </Button>
      <Button variant="outline" size="icon" onClick={undo} disabled={atStart} aria-label="Previous move (←)" title="Previous (←)">
        <ChevronLeft />
      </Button>
      <Button variant="outline" size="icon" onClick={redo} disabled={atEnd} aria-label="Next move (→)" title="Next (→)">
        <ChevronRight />
      </Button>
      <Button variant="outline" size="icon" onClick={toEnd} disabled={atEnd} aria-label="Go to end (↓)" title="End (↓)">
        <ChevronsRight />
      </Button>
      <Button variant="outline" size="icon" onClick={flip} className="ml-2" aria-label="Flip board (F)" title="Flip board (F)">
        <FlipVertical2 />
      </Button>
    </div>
  );
}
