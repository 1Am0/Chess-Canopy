"use client";

import type { Color } from "@/lib/engine/types";
import { useExplorerStore } from "@/lib/store";
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
        return (
          <ToggleGroupItem
            key={s.id}
            value={s.id}
            aria-label={`View games as ${s.label}`}
            className="group/side folder-tab h-[calc(100%-4px)] min-w-0 flex-1 justify-center gap-2 rounded-none border-0 bg-transparent px-2 shadow-none hover:bg-transparent data-[state=on]:h-full data-[state=on]:bg-transparent data-[state=on]:text-ink data-[state=on]:shadow-none [&:not(:first-child)]:ml-0"
          >
            <span
              aria-hidden
              className={cn(
                "text-xl leading-none",
                s.id === "white" ? "text-foreground [text-shadow:0_0_1px_currentColor]" : "text-foreground",
              )}
            >
              {s.glyph}
            </span>
            <span className="relative font-semibold">
              {s.label}
              <PencilUnderline seed={s.id} tone="ink" className="-bottom-[3px] hidden group-data-[state=on]/side:block" />
            </span>
            <span className="min-w-[5ch] text-left font-mono text-xs font-normal text-pencil tabular-nums">
              {n == null ? "–" : n.toLocaleString("en-US")}
            </span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
