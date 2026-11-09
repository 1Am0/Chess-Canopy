"use client";

import { useEffect, useRef, useState, type WheelEvent } from "react";
import { RotateCcw } from "lucide-react";
import { useExplorerStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * chess.com-style move strip: the whole line on ONE row ("1. e4 e5 2. Nf3 Nc6 …") that
 * scrolls horizontally. The strip has a fixed height, so it never changes the layout
 * as the line grows; the current move is scrolled into view automatically, and a
 * vertical mouse wheel scrolls it sideways. Moves past the cursor are the redo branch.
 */
export function LinePanel({ className }: { className?: string }) {
  const path = useExplorerStore((s) => s.path);
  const cursor = useExplorerStore((s) => s.cursor);
  const goTo = useExplorerStore((s) => s.goTo);
  const toStart = useExplorerStore((s) => s.toStart);
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false); // content hidden on the left: fade that edge too

  // Keep the current move in view (horizontally only; never scrolls the page).
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const smooth = typeof window.matchMedia === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = smooth ? "smooth" : "auto";
    const el = box.querySelector<HTMLElement>('[data-current="true"]');
    if (!el || cursor === 0) {
      box.scrollTo({ left: 0, behavior });
      return;
    }
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const left = r.left - b.left + box.scrollLeft;
    const padLeft = 12;
    const padRight = 36; // clear of the fade on the right edge
    if (left - padLeft < box.scrollLeft) box.scrollTo({ left: left - padLeft, behavior });
    else if (left + r.width + padRight > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: left + r.width + padRight - box.clientWidth, behavior });
    }
  }, [cursor, path]);

  // Vertical wheel → horizontal scroll (trackpads already send deltaX).
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const box = scroller.current;
    if (!box || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (box.scrollWidth <= box.clientWidth) return;
    box.scrollLeft += e.deltaY;
  };

  const pairs = Math.ceil(path.length / 2);
  const cell = (i: number) => {
    const san = path[i];
    if (san === undefined) return null;
    const current = i === cursor - 1;
    return (
      <button
        type="button"
        onClick={() => goTo(i + 1)}
        aria-current={current ? "step" : undefined}
        data-current={current || undefined}
        className={cn(
          "h-7 shrink-0 rounded-md px-1.5 font-mono text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60",
          current && "bg-primary font-bold text-primary-foreground hover:bg-primary",
          !current && i >= cursor && "font-normal text-muted-foreground italic",
        )}
      >
        {san}
      </button>
    );
  };

  return (
    <section aria-label="Line" className={cn("flex h-11 shrink-0 items-center gap-1 rounded-lg border bg-card pr-1.5 pl-1", className)}>
      <div
        ref={scroller}
        onWheel={onWheel}
        onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 2)}
        style={scrolled ? { maskImage: "linear-gradient(to right, transparent, black 20px, black calc(100% - 24px), transparent)" } : undefined}
        className="flex min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden overscroll-x-contain pr-6 [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          onClick={() => goTo(0)}
          aria-current={cursor === 0 ? "step" : undefined}
          className={cn(
            "h-7 shrink-0 rounded-md px-2 text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60",
            cursor === 0 && "bg-accent font-medium text-accent-foreground",
          )}
        >
          Start
        </button>
        {path.length === 0 ? (
          <p className="shrink-0 px-2 text-sm whitespace-nowrap text-muted-foreground">Play a move on the board or pick one from the table</p>
        ) : (
          <ol className="flex items-center">
            {Array.from({ length: pairs }).map((_, r) => (
              <li key={r} className="flex shrink-0 items-center whitespace-nowrap">
                <span className="pr-0.5 pl-1.5 font-mono text-xs text-muted-foreground tabular-nums">{r + 1}.</span>
                {cell(r * 2)}
                {cell(r * 2 + 1)}
              </li>
            ))}
          </ol>
        )}
      </div>
      <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={toStart} disabled={cursor === 0} aria-label="Reset to start" title="Reset to start">
        <RotateCcw className="size-3.5" />
      </Button>
    </section>
  );
}
