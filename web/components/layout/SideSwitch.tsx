"use client";

import type { Color } from "@/lib/engine/types";
import { activeFilterCount, useExplorerStore } from "@/lib/store";
import { CountUp } from "@/components/explorer/useCountUp";
import { cn } from "@/lib/utils";
import { PencilUnderline } from "@/components/explorer/ink";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const SIDES: { id: Color; label: string; glyph: string }[] = [
  { id: "white", label: "White", glyph: "♔" },
  { id: "black", label: "Black", glyph: "♚" },
];

/**
 * Two index-card tabs (kit ToggleGroup): the active card sits forward with a pencil underline under its name,
 * the other is a shade darker and a hair lower. Counts are mono.
 * Prominent White | Black switch: which side's repertoire is being explored.
 * Fixed 44px; counts are tabular with a reserved width, so new counts never resize it.
 * Switching keeps the current line and only flips the side and the board.
 */
export function SideSwitch({ className }: { className?: string }) {
  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const counts = useExplorerStore((s) => s.summary?.counts);
  const setSide = useExplorerStore((s) => s.setSide);
  const filterCount = useExplorerStore((s) => activeFilterCount(s.filters));

  // Unfiltered per-side counts of the same players, for "12 of 40" while filters are on.
  const base = useExplorerStore((s) => s.summary?.totals ?? null);

  return (
    <ToggleGroup
      type="single"
      value={side}
      onValueChange={(v) => {
        // Clicking the already-selected side deselects it (v === ""): still an explicit choice,
        // so it must stop the one-time auto pick from moving to the other side.
        if (v === "white" || v === "black") setSide(v);
        else setSide(side);
      }}
      aria-label="Side to view"
      className={cn("grid h-11 w-full shrink-0 grid-cols-2 items-end gap-1.5", className)}
    >
      {SIDES.map((s) => {
        const n = counts?.[s.id];
        const of = filterCount > 0 && base && n != null && base[s.id] > n ? base[s.id] : null;
        const zero = n === 0;
        return (
          <ToggleGroupItem
            key={s.id}
            value={s.id}
            aria-label={`View games as ${s.label}`}
            className="group/side folder-tab h-[calc(100%-4px)] [&:not([data-state=on])]:[--tab-fill:color-mix(in_oklab,var(--sheet-under)_78%,var(--rule-strong))] min-w-0 flex-1 justify-center gap-2 rounded-none border-0 bg-transparent px-2 shadow-none hover:bg-transparent data-[state=on]:h-full data-[state=on]:bg-transparent data-[state=on]:text-ink data-[state=on]:shadow-none [&:not(:first-child)]:ml-0"
          >
            <span
              aria-hidden
              className={cn(
                "text-xl leading-none",
                s.id === "white" ? "text-foreground [text-shadow:0_0_1px_currentColor]" : "text-foreground",
                zero && "opacity-45",
              )}
            >
              {s.glyph}
            </span>
            <span className={cn("relative font-semibold", zero && "font-medium text-muted-foreground")}>
              {s.label}
              <PencilUnderline seed={s.id} tone="ink" className="-bottom-[3px] hidden group-data-[state=on]/side:block" />
            </span>
            <span className={cn("text-left font-mono text-xs font-normal text-pencil tabular-nums", of != null ? "min-w-[8ch]" : "min-w-[5ch]")}>
              {n == null ? (
                "–"
              ) : (
                <>
                  <CountUp value={n} format={(v) => v.toLocaleString("en-US")} />
                  {of != null && ` of ${of.toLocaleString("en-US")}`}
                </>
              )}
            </span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
