"use client";

import type { Filters } from "@/lib/engine/types";
import { useExplorerStore } from "@/lib/store";
import { InkCross } from "@/components/explorer/ink";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function range(lo?: number | null, hi?: number | null): string {
  if (lo != null && hi != null) return lo <= hi ? `${lo}–${hi}` : `${hi}–${lo}`;
  if (lo != null) return `≥ ${lo}`;
  return `≤ ${hi}`;
}

/** Text-link buttons ("+ Add filter", "Clear all"): same size in both states, so the row never changes height. */
const LINK_BTN = "h-7 shrink-0 px-2 text-sm font-medium text-ink underline decoration-ink/40 underline-offset-[3px] hover:bg-transparent hover:decoration-ink";

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
          <p className="min-w-0 flex-1 truncate text-sm text-pencil">All games · no filters</p>
          <Button variant="ghost" size="sm" aria-label="Add filter" className={LINK_BTN} onClick={() => setUi({ filtersOpen: true })}>
            <span aria-hidden>+ Add filter</span>
          </Button>
        </>
      ) : (
        <>
          <div
            aria-label="Active filters"
            role="group"
            className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {chips.map((c) => (
              <span key={c.label} className="inline-flex h-6 shrink-0 items-center gap-1 border border-rule-strong pr-0.5 pl-2 text-xs text-ink">
                {c.label}
                <button
                  type="button"
                  onClick={() => setFilters(c.clear)}
                  aria-label={`Remove filter ${c.label}`}
                  className="grid size-5 place-items-center text-[color:var(--tag-ink)] outline-none hover:text-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[-1px] focus-visible:outline-ring"
                >
                  <InkCross seed={c.label} />
                </button>
              </span>
            ))}
          </div>
          <Button variant="ghost" size="sm" className={LINK_BTN} onClick={clear}>
            Clear all
          </Button>
        </>
      )}
    </div>
  );
}
