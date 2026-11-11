"use client";

import type { Filters } from "@/lib/engine/types";
import { useExplorerStore } from "@/lib/store";
import { InkCross, PencilUnderline } from "@/components/explorer/ink";
import { PaperClip, PaperLabel } from "@/components/paper";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function range(lo?: number | null, hi?: number | null): string {
  if (lo != null && hi != null) return lo <= hi ? `${lo}–${hi}` : `${hi}–${lo}`;
  if (lo != null) return `≥ ${lo}`;
  return `≤ ${hi}`;
}

const PRESET_LABEL: Record<number, string> = { 30: "last 30 days", 90: "last 90 days", 365: "last year" };

function chipsFor(filters: Filters): { label: string; clear: Partial<Filters> }[] {
  const chips: { label: string; clear: Partial<Filters> }[] = [];
  if (filters.result)
    chips.push({
      label: `Result: ${filters.result === "1-0" ? "Win" : filters.result === "0-1" ? "Loss" : "Draw"}`,
      clear: { result: null },
    });
  if (filters.opponent) chips.push({ label: `vs ${filters.opponent}`, clear: { opponent: null } });
  if (filters.time_control) chips.push({ label: `Time: ${filters.time_control}`, clear: { time_control: null } });
  if (filters.time_control_raw) chips.push({ label: `TC ${filters.time_control_raw}`, clear: { time_control_raw: null } });
  if (filters.date_preset)
    chips.push({
      label: `Date: ${PRESET_LABEL[filters.date_preset] ?? `last ${filters.date_preset} days`}`,
      clear: { date_preset: null, date_from: null, date_to: null },
    });
  else if (filters.date_from || filters.date_to)
    chips.push({
      label: `Date: ${filters.date_from ?? "…"} → ${filters.date_to ?? "now"}`,
      clear: { date_preset: null, date_from: null, date_to: null },
    });
  if (filters.min_my_rating != null || filters.max_my_rating != null)
    chips.push({ label: `My rating ${range(filters.min_my_rating, filters.max_my_rating)}`, clear: { min_my_rating: null, max_my_rating: null } });
  if (filters.min_opponent_rating != null || filters.max_opponent_rating != null)
    chips.push({
      label: `Opp. rating ${range(filters.min_opponent_rating, filters.max_opponent_rating)}`,
      clear: { min_opponent_rating: null, max_opponent_rating: null },
    });
  // moves_start / moves_end exist only for CLI parity; the UI never sets or shows them.
  return chips;
}

/**
 * Fixed 32px row that is always present, so applying or clearing a filter never moves
 * anything below it. Active filters are removable chips in a single-line horizontal
 * scroll strip; with none it reads "All games · no filters".
 */
export function FilterRow({ className }: { className?: string }) {
  const filters = useExplorerStore((s) => s.filters);
  const setFilters = useExplorerStore((s) => s.setFilters);
  const clear = useExplorerStore((s) => s.clearFilters);
  const setUi = useExplorerStore((s) => s.setUi);
  const chips = chipsFor(filters);

  return (
    <div data-slot="filter-row" className={cn("flex h-8 min-w-0 shrink-0 items-center gap-2", className)}>
      {chips.length === 0 ? (
        <>
          <p className="min-w-0 flex-1 truncate text-sm text-pencil/80">All games · no filters</p>
          <Button variant="ghost" size="sm" aria-label="Add filter" className="group/add h-7 px-2 font-hand text-[19px] leading-none font-medium text-pencil" onClick={() => setUi({ filtersOpen: true })}>
            <span aria-hidden className="relative inline-block pb-px">
              + add filter
              <PencilUnderline seed="add" className="top-full -mt-[2px]" />
            </span>
          </Button>
        </>
      ) : (
        <>
          <div
            aria-label="Active filters"
            role="group"
            className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 pt-1 overscroll-x-contain whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {chips.map((c, i) => (
              <PaperLabel key={c.label} tone="manila" rotate={i % 2 ? 0.7 : -0.6} className="relative h-6 gap-1.5 pr-0.5 pl-[17px] tracking-wide text-[color:var(--tag-ink)]">
                {/* a small paper clip holds the tag to the sheet */}
                <PaperClip size={0.5} angle={i % 2 ? 6 : -5} className="absolute top-[-3px] left-[3px]" />
                {c.label}
                <button
                  type="button"
                  onClick={() => setFilters(c.clear)}
                  aria-label={`Remove filter ${c.label}`}
                  className="grid size-5 place-items-center text-[color:var(--tag-ink)]/75 outline-none hover:text-[color:var(--tag-ink)] focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-ring"
                >
                  <InkCross seed={c.label} />
                </button>
              </PaperLabel>
            ))}
          </div>
          <Button variant="tag" size="xs" className="shrink-0" onClick={clear}>
            Clear all
          </Button>
        </>
      )}
    </div>
  );
}
