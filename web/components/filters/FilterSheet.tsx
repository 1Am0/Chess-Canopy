"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import type { Filters } from "@/lib/engine/types";
import { getExplorer } from "@/lib/explorer-client";
import { activeFilterCount, useExplorerStore } from "@/lib/store";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const TIME_CONTROLS = ["bullet", "blitz", "rapid", "classical", "daily"] as const;
const R_MIN = 400;
const R_MAX = 3000;

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function RatingRange({
  label,
  idBase,
  min,
  max,
  onChange,
}: {
  label: string;
  idBase: string;
  min: number | null | undefined;
  max: number | null | undefined;
  onChange: (min: number | null, max: number | null) => void;
}) {
  return (
    <Field label={label}>
      <Slider
        min={R_MIN}
        max={R_MAX}
        step={25}
        value={[min ?? R_MIN, max ?? R_MAX]}
        onValueChange={([lo, hi]) => onChange(lo <= R_MIN ? null : lo, hi >= R_MAX ? null : hi)}
        aria-label={label}
      />
      <div className="flex items-center gap-2">
        <Input
          id={`${idBase}-min`}
          type="number"
          inputMode="numeric"
          placeholder="Min"
          aria-label={`${label} minimum`}
          value={min ?? ""}
          onChange={(e) => onChange(numOrNull(e.target.value), max ?? null)}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          id={`${idBase}-max`}
          type="number"
          inputMode="numeric"
          placeholder="Max"
          aria-label={`${label} maximum`}
          value={max ?? ""}
          onChange={(e) => onChange(min ?? null, numOrNull(e.target.value))}
        />
      </div>
    </Field>
  );
}

function OpponentCombobox() {
  const opponent = useExplorerStore((s) => s.filters.opponent);
  const setFilters = useExplorerStore((s) => s.setFilters);
  const version = useExplorerStore((s) => s.selectionVersion);
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    getExplorer().opponents().then(setNames).catch(() => setNames([]));
  }, [open, version]);

  const shown = names.filter((n) => n.toLowerCase().includes(q.toLowerCase())).slice(0, 50);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={opponent ? "" : "text-muted-foreground"}>{opponent || "Any opponent"}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search opponents…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>No opponents found.</CommandEmpty>
            <CommandGroup>
              {shown.map((n) => (
                <CommandItem
                  key={n}
                  value={n}
                  onSelect={() => {
                    setFilters({ opponent: n });
                    setOpen(false);
                  }}
                >
                  <Check className={`size-4 ${opponent?.toLowerCase() === n.toLowerCase() ? "opacity-100" : "opacity-0"}`} />
                  {n}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const PRESETS = [[30, "30 days"], [90, "90 days"], [365, "1 year"]] as const;

function datePreset(f: Filters): number | "all" | "custom" {
  if (f.date_preset) return f.date_preset;
  if (!f.date_from && !f.date_to) return "all";
  return "custom";
}

export function FilterSheet() {
  const open = useExplorerStore((s) => s.filtersOpen);
  const filters = useExplorerStore((s) => s.filters);
  const setFilters = useExplorerStore((s) => s.setFilters);
  const clearFilters = useExplorerStore((s) => s.clearFilters);
  const setUi = useExplorerStore((s) => s.setUi);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const count = activeFilterCount(filters);
  const preset = datePreset(filters);

  const patch = (p: Partial<Filters>) => setFilters(p);

  return (
    <Sheet open={open} onOpenChange={(o) => setUi({ filtersOpen: o })}>
      <SheetContent side={desktop ? "right" : "bottom"} className="max-h-[88dvh] gap-0 lg:max-h-none lg:w-[26rem] lg:max-w-[26rem]">
        <SheetHeader className="border-b">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Results update as you change filters. Win / Draw / Loss is from your point of view.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <Field label="Result">
            <ToggleGroup
              type="single"
              value={filters.result ?? "any"}
              onValueChange={(v) => v && patch({ result: v === "any" ? null : (v as Filters["result"]) })}
              aria-label="Result"
              className="w-full"
            >
              <ToggleGroupItem value="any" className="flex-1">Any</ToggleGroupItem>
              <ToggleGroupItem value="1-0" className="flex-1">Win</ToggleGroupItem>
              <ToggleGroupItem value="1/2-1/2" className="flex-1">Draw</ToggleGroupItem>
              <ToggleGroupItem value="0-1" className="flex-1">Loss</ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field label="Time control">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Time control">
              {TIME_CONTROLS.map((tc) => {
                const on = filters.time_control === tc;
                return (
                  <Button
                    key={tc}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    className="rounded-full capitalize"
                    onClick={() => patch({ time_control: on ? null : tc })}
                  >
                    {tc}
                  </Button>
                );
              })}
            </div>
            <Input
              placeholder="Raw time control, e.g. 180+2"
              aria-label="Raw time control"
              value={filters.time_control_raw ?? ""}
              onChange={(e) => patch({ time_control_raw: e.target.value.trim() || null })}
            />
          </Field>

          <RatingRange
            label="My rating"
            idBase="my"
            min={filters.min_my_rating}
            max={filters.max_my_rating}
            onChange={(a, b) => patch({ min_my_rating: a, max_my_rating: b })}
          />
          <RatingRange
            label="Opponent rating"
            idBase="opp"
            min={filters.min_opponent_rating}
            max={filters.max_opponent_rating}
            onChange={(a, b) => patch({ min_opponent_rating: a, max_opponent_rating: b })}
          />

          <Field label="Date">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date presets">
              {([...PRESETS, ["all", "All time"]] as const).map(([v, label]) => (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={preset === v ? "default" : "outline"}
                  aria-pressed={preset === v}
                  className="rounded-full"
                  onClick={() => patch(v === "all" ? { date_preset: null, date_from: null, date_to: null } : { date_preset: v, date_from: null, date_to: null })}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" aria-label="From date" value={filters.date_from ?? ""} onChange={(e) => patch({ date_preset: null, date_from: e.target.value || null })} />
              <Input type="date" aria-label="To date" value={filters.date_to ?? ""} onChange={(e) => patch({ date_preset: null, date_to: e.target.value || null })} />
            </div>
          </Field>

          <Field label="Opponent">
            <div className="flex gap-1.5">
              <div className="min-w-0 flex-1"><OpponentCombobox /></div>
              {filters.opponent && (
                <Button variant="ghost" size="icon" aria-label="Clear opponent" onClick={() => patch({ opponent: null })}>
                  <X />
                </Button>
              )}
            </div>
          </Field>
        </div>

        <SheetFooter className="flex-row border-t">
          <Button variant="outline" className="flex-1" onClick={clearFilters} disabled={count === 0}>
            Reset{count ? ` (${count})` : ""}
          </Button>
          <Button className="flex-1" onClick={() => setUi({ filtersOpen: false })}>Done</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
