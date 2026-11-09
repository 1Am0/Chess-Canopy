"use client";

import type { Color } from "@/lib/engine/types";
import { useExplorerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const SIDES: { id: Color; label: string; glyph: string }[] = [
  { id: "white", label: "White", glyph: "♔" },
  { id: "black", label: "Black", glyph: "♚" },
];

/** Prominent White | Black switch: which side's repertoire is being explored. */
export function SideSwitch({ className }: { className?: string }) {
  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const counts = useExplorerStore((s) => s.summary?.counts);
  const setSide = useExplorerStore((s) => s.setSide);

  return (
    <ToggleGroup
      type="single"
      value={side}
      onValueChange={(v) => {
        if (v === "white" || v === "black") setSide(v);
      }}
      aria-label="Side to view"
      className={cn("grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1", className)}
    >
      {SIDES.map((s) => {
        const n = counts?.[s.id];
        return (
          <ToggleGroupItem
            key={s.id}
            value={s.id}
            aria-label={`View games as ${s.label}`}
            className="h-10 min-w-0 flex-1 justify-center gap-2 rounded-md border-0 bg-transparent px-2 first:rounded-md last:rounded-md [&:not(:first-child)]:ml-0 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm data-[state=on]:ring-1 data-[state=on]:ring-border"
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
            <span className="font-semibold">{s.label}</span>
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {n == null ? "–" : n.toLocaleString("en-US")}
            </span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
