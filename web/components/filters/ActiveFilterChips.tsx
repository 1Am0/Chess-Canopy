"use client";

import { X } from "lucide-react";
import type { Filters } from "@/lib/engine/types";
import { useExplorerStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

function range(lo?: number | null, hi?: number | null): string {
  if (lo != null && hi != null) return `${lo}–${hi}`;
  if (lo != null) return `≥ ${lo}`;
  return `≤ ${hi}`;
}

export function ActiveFilterChips() {
  const filters = useExplorerStore((s) => s.filters);
  const setFilters = useExplorerStore((s) => s.setFilters);
  const clear = useExplorerStore((s) => s.clearFilters);

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
  if (filters.moves_start != null || filters.moves_end != null)
    chips.push({ label: `Moves ${range(filters.moves_start, filters.moves_end)}`, clear: { moves_start: null, moves_end: null } });

  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {chips.map((c) => (
        <span key={c.label} className="inline-flex items-center gap-1 rounded-full border bg-secondary py-0.5 pr-0.5 pl-2.5 text-xs font-medium">
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
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clear}>Clear all</Button>
    </div>
  );
}
