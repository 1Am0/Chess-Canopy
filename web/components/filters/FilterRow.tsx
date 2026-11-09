"use client";

import { SlidersHorizontal, X } from "lucide-react";
import type { Filters } from "@/lib/engine/types";
import { useExplorerStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function range(lo?: number | null, hi?: number | null): string {
  if (lo != null && hi != null) return `${lo}–${hi}`;
  if (lo != null) return `≥ ${lo}`;
  return `≤ ${hi}`;
}

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
  if (filters.date_from || filters.date_to)
    chips.push({
      label: `Date: ${filters.date_from ?? "…"} → ${filters.date_to ?? "now"}`,
      clear: { date_from: null, date_to: null },
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
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">All games · no filters</p>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={() => setUi({ filtersOpen: true })}>
            <SlidersHorizontal className="size-3.5" /> Add filter
          </Button>
        </>
      ) : (
        <>
          <div
            aria-label="Active filters"
            role="group"
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {chips.map((c) => (
              <span key={c.label} className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border bg-secondary pr-0.5 pl-2.5 text-xs font-medium">
                {c.label}
                <button
                  type="button"
                  onClick={() => setFilters(c.clear)}
                  aria-label={`Remove filter ${c.label}`}
                  className="rounded-full p-0.5 text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={clear}>
            Clear all
          </Button>
        </>
      )}
    </div>
  );
}
