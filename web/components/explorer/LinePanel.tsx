"use client";

import { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { useExplorerStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Lichess-style move list: each pair is an index cell plus a White and a Black cell
 * (28px rows); pairs flow into as many columns as the width allows. The body has a
 * fixed height and scrolls internally, keeping the current move in view, so the
 * panel never grows with the line. Moves past the cursor are the redo branch.
 *
 * variant "card": standalone bordered panel with a fixed 7.5rem body (desktop).
 * variant "fill": borderless, the body fills the parent (mobile tab panel).
 */
export function LinePanel({
  className,
  variant = "card",
  active = true,
}: {
  className?: string;
  variant?: "card" | "fill";
  /** Re-run "keep the current move in view" when the panel becomes visible. */
  active?: boolean;
}) {
  const path = useExplorerStore((s) => s.path);
  const cursor = useExplorerStore((s) => s.cursor);
  const goTo = useExplorerStore((s) => s.goTo);
  const toStart = useExplorerStore((s) => s.toStart);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = scroller.current;
    if (!box || !active) return;
    const el = box.querySelector<HTMLElement>('[data-current="true"]');
    if (!el || cursor === 0) {
      box.scrollTop = 0;
      return;
    }
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const top = r.top - b.top + box.scrollTop;
    const pad = 4;
    if (top - pad < box.scrollTop) box.scrollTop = top - pad;
    else if (top + r.height + pad > box.scrollTop + box.clientHeight) box.scrollTop = top + r.height + pad - box.clientHeight;
  }, [cursor, path, active]);

  const rowCount = Math.ceil(path.length / 2);
  const cell = (i: number) => {
    const san = path[i];
    if (san === undefined) return <span aria-hidden className="h-7" />;
    const current = i === cursor - 1;
    return (
      <button
        type="button"
        onClick={() => goTo(i + 1)}
        aria-current={current ? "step" : undefined}
        data-current={current || undefined}
        className={cn(
          "h-7 min-w-0 truncate px-2 text-left font-mono text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60",
          current && "bg-primary font-bold text-primary-foreground hover:bg-primary",
          !current && i >= cursor && "font-normal text-muted-foreground/75 italic",
        )}
      >
        {san}
      </button>
    );
  };

  return (
    <section
      aria-label="Line"
      className={cn("@container flex min-h-0 flex-col overflow-hidden", variant === "card" && "shrink-0 rounded-lg border bg-card", className)}
    >
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b px-3">
        <h2 className="truncate text-sm font-medium">
          Line
          <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">
            {cursor < path.length ? `${cursor} / ${path.length} ply` : `${path.length} ply`}
          </span>
        </h2>
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={toStart} disabled={cursor === 0} aria-label="Reset to start">
          <RotateCcw className="size-3.5" /> Reset
        </Button>
      </div>
      <div
        ref={scroller}
        className={cn(
          "overflow-y-auto overscroll-contain p-1 [scrollbar-gutter:stable] [scrollbar-width:thin]",
          variant === "card" ? "h-[7.5rem]" : "min-h-0 flex-1",
        )}
      >
        <button
          type="button"
          onClick={() => goTo(0)}
          aria-current={cursor === 0 ? "step" : undefined}
          className={cn(
            "flex h-7 w-full items-center rounded-sm px-2 text-left text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60",
            cursor === 0 && "bg-accent font-medium text-accent-foreground",
          )}
        >
          Start
        </button>
        {path.length === 0 ? (
          <p className="flex h-7 items-center px-2 text-sm text-muted-foreground">Play a move on the board or pick one from the table</p>
        ) : (
          <ol className="grid grid-cols-1 gap-x-1.5 @[22rem]:grid-cols-2 @[34rem]:grid-cols-3 @[46rem]:grid-cols-4">
            {Array.from({ length: rowCount }).map((_, r) => (
              <li key={r} className="grid h-7 grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] items-stretch overflow-hidden rounded-sm">
                <span className="flex items-center justify-center border-r bg-muted/70 font-mono text-xs text-muted-foreground tabular-nums">
                  {r + 1}
                </span>
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
