"use client";

import { AlertTriangle, FilterX, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A static sapling: a hairline trunk and three faint branches. */
export function Sapling({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={cn("size-16 text-muted-foreground", className)} aria-hidden>
      <g stroke="currentColor" strokeLinecap="round" opacity={0.35}>
        <path d="M32 60V34" strokeWidth={1.5} />
        <path d="M32 40C32 34 25 33 20 26" strokeWidth={1.25} />
        <path d="M32 36C32 29 40 28 45 20" strokeWidth={1.25} />
        <path d="M32 34V16" strokeWidth={1.25} />
      </g>
      <g fill="currentColor" opacity={0.35}>
        <circle cx={20} cy={26} r={1.75} />
        <circle cx={45} cy={20} r={1.75} />
        <circle cx={32} cy={16} r={1.75} />
      </g>
      <path d="M12 60H52" stroke="currentColor" strokeWidth={1} opacity={0.25} />
    </svg>
  );
}

const WRAP = "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center";

export function CanopyLoading() {
  return (
    <div className={cn(WRAP, "pointer-events-none")} aria-hidden>
      <Sapling />
      <p className="text-xs text-muted-foreground">Growing the canopy…</p>
    </div>
  );
}

export function CanopyError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={WRAP} role="alert">
      <AlertTriangle className="size-6 text-muted-foreground" />
      <div>
        <p className="font-medium">Couldn&apos;t grow the canopy.</p>
        <p className="text-sm text-muted-foreground">Something went wrong while reading the saved games.</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RotateCcw /> Retry
      </Button>
    </div>
  );
}

export function CanopyNoGames({
  side,
  filterCount,
  otherCount,
  onOtherSide,
  onClearFilters,
}: {
  side: "white" | "black";
  filterCount: number;
  otherCount: number;
  onOtherSide: () => void;
  onClearFilters: () => void;
}) {
  const other = side === "white" ? "Black" : "White";
  return (
    <div className={WRAP}>
      {filterCount === 0 && otherCount > 0 ? (
        <>
          <div>
            <p className="font-medium">No games as {side === "white" ? "White" : "Black"}</p>
            <p className="text-sm text-muted-foreground">This selection only has games with the other color.</p>
          </div>
          <Button size="sm" variant="outline" onClick={onOtherSide}>
            View as {other} ({otherCount.toLocaleString()} {otherCount === 1 ? "game" : "games"})
          </Button>
        </>
      ) : (
        <>
          <FilterX className="size-6 text-muted-foreground" />
          <div>
            <p className="font-medium">{filterCount > 0 ? "No games match these filters" : "No games to grow from"}</p>
            <p className="text-sm text-muted-foreground">
              {filterCount > 0 ? "Loosen or clear the filters to see your canopy." : "There are no games for the current selection."}
            </p>
          </div>
          {filterCount > 0 && (
            <Button size="sm" variant="outline" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export function CanopyOutOfBook({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  return (
    <div className="absolute inset-x-0 top-[14%] z-10 flex flex-col items-center gap-3 px-6 text-center">
      <div>
        <p className="font-medium">Out of book</p>
        <p className="text-sm text-muted-foreground">None of your games reached this position.</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onBack}>
          <Undo2 /> Back one move
        </Button>
        <Button size="sm" variant="outline" onClick={onStart}>
          <RotateCcw /> To start
        </Button>
      </div>
    </div>
  );
}
