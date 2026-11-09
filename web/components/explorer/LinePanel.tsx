"use client";

import { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { useExplorerStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Lichess-style two-column move list; moves past the cursor are the redo branch. */
export function LinePanel({ className }: { className?: string }) {
  const path = useExplorerStore((s) => s.path);
  const cursor = useExplorerStore((s) => s.cursor);
  const goTo = useExplorerStore((s) => s.goTo);
  const toStart = useExplorerStore((s) => s.toStart);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!box) return;
    if (!el) {
      box.scrollTop = 0;
      return;
    }
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop) box.scrollTop = top - 4;
    else if (top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + el.offsetHeight - box.clientHeight + 4;
  }, [cursor, path]);

  const rowCount = Math.ceil(path.length / 2);
  const cell = (i: number) => {
    const san = path[i];
    if (san === undefined) return <span />;
    const current = i === cursor - 1;
    return (
      <button
        type="button"
        onClick={() => goTo(i + 1)}
        aria-current={current ? "step" : undefined}
        className={cn(
          "truncate rounded-full px-2.5 py-0.5 text-left font-mono text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60",
          current && "bg-foreground font-bold text-background hover:bg-foreground",
          i >= cursor && "text-muted-foreground/70 italic",
        )}
      >
        {san}
      </button>
    );
  };

  return (
    <section aria-label="Line" className={cn("@container rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-3 py-1">
        <h2 className="text-sm font-medium">
          Line <span className="ml-1 text-xs font-normal text-muted-foreground tabular-nums">{path.length} ply</span>
        </h2>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={toStart} disabled={cursor === 0} aria-label="Reset to start">
          <RotateCcw className="size-3.5" /> Reset
        </Button>
      </div>
      <div ref={scroller} className="relative max-h-[15.5rem] overflow-y-auto p-1">
        <button
          type="button"
          onClick={() => goTo(0)}
          aria-current={cursor === 0 && path.length > 0 ? "step" : undefined}
          className={cn(
            "mb-0.5 block w-full rounded px-2 py-1 text-left text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60",
            cursor === 0 && path.length > 0 && "bg-accent text-foreground",
          )}
        >
          Start
        </button>
        {path.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Play a move on the board or pick one below</p>
        ) : (
          <ol className={cn(rowCount > 5 && "@lg:columns-2 @lg:gap-x-4")}>
            {Array.from({ length: rowCount }).map((_, r) => (
              <li key={r} className="grid grid-cols-[2.25rem_minmax(0,6.5rem)_minmax(0,6.5rem)] items-center break-inside-avoid py-px">
                <span className="pr-1.5 text-right font-mono text-xs text-muted-foreground tabular-nums">{r + 1}</span>
                {cell(r * 2)}
                {cell(r * 2 + 1)}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
