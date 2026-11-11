"use client";

import type { Color } from "@/lib/engine/types";
import { useExplorerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const SIDES: { id: Color; label: string }[] = [
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
];

/**
 * Two underline tabs (kit ToggleGroup) with the game count after each name.
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
      className={cn("grid h-11 w-full shrink-0 grid-cols-2 items-end border-b border-border", className)}
    >
      {SIDES.map((s) => {
        const n = counts?.[s.id];
        return (
          <ToggleGroupItem
            key={s.id}
            value={s.id}
            aria-label={`View games as ${s.label}`}
            className="group/side -mb-px h-full min-w-0 flex-1 justify-center gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-2 first:rounded-none last:rounded-none hover:bg-accent data-[state=on]:border-primary data-[state=on]:bg-transparent data-[state=on]:text-strong [&:not(:first-child)]:ml-0"
          >
            <span className="font-semibold">{s.label}</span>
            <span className="min-w-[5ch] text-left text-sm font-normal text-muted-foreground tabular-nums">
              {n == null ? "–" : n.toLocaleString("en-US")}
            </span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
