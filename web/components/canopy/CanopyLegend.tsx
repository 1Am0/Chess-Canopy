import { cn } from "@/lib/utils";

/** Same stops as the canvas ramp (OKLab, 30% to 70%), so the key can't drift from the drawing. */
const RAMP = "linear-gradient(in oklab 90deg, var(--canopy-low), var(--canopy-mid), var(--canopy-high))";

function Swatch() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="tabular-nums">30%</span>
      <span aria-hidden className="h-1.5 w-14 rounded-full" style={{ backgroundImage: RAMP }} />
      <span className="tabular-nums">70%</span>
    </span>
  );
}

/** One-line key, bottom-left of the canvas. Hidden when the region is small (the Info popover has it). */
export function CanopyLegend({ className }: { className?: string }) {
  return (
    <p
      data-testid="canopy-legend"
      className={cn(
        "pointer-events-none flex items-center gap-2 text-[11px] leading-none whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <span className="font-medium text-foreground/70">Score</span>
      <Swatch />
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/70" /> game
      </span>
      <span aria-hidden>·</span>
      <span>width = games</span>
    </p>
  );
}

/** The same key as a stacked list, for the Info popover. */
export function CanopyKey() {
  return (
    <dl className="grid gap-2.5 text-xs">
      <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
        <dt className="font-medium text-foreground">Score</dt>
        <dd className="flex items-center text-muted-foreground">
          <Swatch />
        </dd>
      </div>
      <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
        <dt className="font-medium text-foreground">Dots</dt>
        <dd className="text-muted-foreground">One game each, drawn to its last move. Hollow means it goes on.</dd>
      </div>
      <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
        <dt className="font-medium text-foreground">Width</dt>
        <dd className="text-muted-foreground">Thicker branches carry more games.</dd>
      </div>
      <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
        <dt className="font-medium text-foreground">Rows</dt>
        <dd className="text-muted-foreground">Rows are moves. Later moves spread toward the top.</dd>
      </div>
    </dl>
  );
}
