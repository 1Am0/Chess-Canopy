"use client";

import type { Color } from "@/lib/engine/types";
import { useExplorerStore } from "@/lib/store";
import { PencilUnderline } from "@/components/explorer/ink";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const SIDES: { id: Color; label: string; glyph: string }[] = [
  { id: "white", label: "White", glyph: "♔" },
  { id: "black", label: "Black", glyph: "♚" },
];

/** The explorer's White | Black index-card tabs (SideSwitch), without its game counts (the explorer's summary is not loaded here). */
export function RepertoireSideSwitch() {
  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const setSide = useExplorerStore((s) => s.setSide);
  return (
    <ToggleGroup
      type="single"
      value={side}
      onValueChange={(v) => setSide(v === "white" || v === "black" ? v : side)}
      aria-label="Side to view"
      className="grid h-11 w-full shrink-0 grid-cols-2 items-end gap-1.5"
    >
      {SIDES.map((s) => (
        <ToggleGroupItem
          key={s.id}
          value={s.id}
          aria-label={`Repertoire as ${s.label}`}
          className="group/side folder-tab h-[calc(100%-4px)] [&:not([data-state=on])]:[--tab-fill:color-mix(in_oklab,var(--sheet-under)_78%,var(--rule-strong))] min-w-0 flex-1 justify-center gap-2 rounded-none border-0 bg-transparent px-2 shadow-none hover:bg-transparent data-[state=on]:h-full data-[state=on]:bg-transparent data-[state=on]:text-ink data-[state=on]:shadow-none [&:not(:first-child)]:ml-0"
        >
          <span aria-hidden className={cn("text-xl leading-none text-foreground", s.id === "white" && "[text-shadow:0_0_1px_currentColor]")}>
            {s.glyph}
          </span>
          <span className="relative font-semibold">
            {s.label}
            <PencilUnderline seed={s.id} tone="ink" className="-bottom-[3px] hidden group-data-[state=on]/side:block" />
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
