"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Link2, ListOrdered, FlipVertical2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useExplorerStore } from "@/lib/store";
import { usePosition } from "@/hooks/use-position";

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      if (!ok) throw new Error("copy failed");
    } catch {
      toast.error(`Couldn't copy ${what}`);
      return;
    }
  }
  toast.success("Copied", { description: what });
}

function toPgn(moves: string[]): string {
  const out: string[] = [];
  moves.forEach((san, i) => {
    out.push(i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san);
  });
  return out.join(" ");
}

function Tip({ label, keys, children }: { label: string; keys?: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        {label}
        {keys && <kbd className="ml-1.5 rounded bg-primary-foreground/20 px-1 font-mono text-[10px]">{keys}</kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

// Below sm (640px) buttons are 32px and the groups are tight so both groups fit on one row
// in the 276px-wide toolbar of a 320px viewport. From sm up, the original 36px / gap-0.5 look.
const btn = "size-8 min-h-8 min-w-8 sm:size-9 sm:min-h-9 sm:min-w-9";
const group = "flex items-center gap-0 sm:gap-0.5 rounded-lg border bg-card p-0.5 shadow-xs";

export function BoardControls() {
  const cursor = useExplorerStore((s) => s.cursor);
  const pathLength = useExplorerStore((s) => s.path.length);
  const toStart = useExplorerStore((s) => s.toStart);
  const undo = useExplorerStore((s) => s.undo);
  const redo = useExplorerStore((s) => s.redo);
  const toEnd = useExplorerStore((s) => s.toEnd);
  const flip = useExplorerStore((s) => s.flip);
  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const { fen, visible } = usePosition();
  const atStart = cursor === 0;
  const atEnd = cursor >= pathLength;

  const copyFen = () => copyText(fen, "FEN");
  const copyPgn = () => {
    // Validate by replaying so the PGN only contains legal moves.
    const chess = new Chess();
    const ok: string[] = [];
    for (const san of visible) {
      try {
        chess.move(san);
        ok.push(san);
      } catch {
        break;
      }
    }
    void copyText(toPgn(ok) || "(starting position)", "PGN");
  };
  const copyLink = () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    if (visible.length) url.searchParams.set("line", visible.join(","));
    url.searchParams.set("side", side);
    void copyText(url.toString(), "Share link");
  };

  return (
    <div role="toolbar" aria-label="Board controls" className="flex flex-wrap items-center justify-between gap-x-1 gap-y-1">
      <div className={group}>
        <Tip label="Start" keys="↑">
          <Button variant="ghost" size="icon" className={btn} onClick={toStart} disabled={atStart} aria-label="Go to start (↑)">
            <ChevronsLeft />
          </Button>
        </Tip>
        <Tip label="Previous move" keys="←">
          <Button variant="ghost" size="icon" className={btn} onClick={undo} disabled={atStart} aria-label="Previous move (←)">
            <ChevronLeft />
          </Button>
        </Tip>
        <Tip label="Next move" keys="→">
          <Button variant="ghost" size="icon" className={btn} onClick={redo} disabled={atEnd} aria-label="Next move (→)">
            <ChevronRight />
          </Button>
        </Tip>
        <Tip label="End" keys="↓">
          <Button variant="ghost" size="icon" className={btn} onClick={toEnd} disabled={atEnd} aria-label="Go to end (↓)">
            <ChevronsRight />
          </Button>
        </Tip>
      </div>
      <div className={group}>
        <Tip label="Flip board" keys="F">
          <Button variant="ghost" size="icon" className={btn} onClick={flip} aria-label="Flip board (F)">
            <FlipVertical2 />
          </Button>
        </Tip>
        <span className="mx-0 h-5 w-px bg-border sm:mx-0.5" aria-hidden />
        <Tip label="Copy FEN">
          <Button variant="ghost" size="icon" className={btn} onClick={copyFen} aria-label="Copy FEN">
            <Copy />
          </Button>
        </Tip>
        <Tip label="Copy PGN of this line">
          <Button variant="ghost" size="icon" className={btn} onClick={copyPgn} aria-label="Copy PGN">
            <ListOrdered />
          </Button>
        </Tip>
        <Tip label="Copy share link">
          <Button variant="ghost" size="icon" className={btn} onClick={copyLink} aria-label="Copy share link">
            <Link2 />
          </Button>
        </Tip>
      </div>
    </div>
  );
}
