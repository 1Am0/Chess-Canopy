"use client";

import { useEffect, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import type { Filters } from "@/lib/engine/types";
import { getExplorer } from "@/lib/explorer-client";
import { activeFilterCount, useExplorerStore } from "@/lib/store";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { CountedOption, FieldSection } from "@/components/field";
import { InkTick } from "@/components/field/InkTick";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tape } from "@/components/paper";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const TIME_CONTROLS = ["bullet", "blitz", "rapid", "classical", "daily"] as const;
const R_MIN = 400;
const R_MAX = 3000;

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

const show = (n: number | null | undefined) => (n == null ? "" : String(n));

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
  // The number boxes are drafts: they are applied on blur / Enter (typing "1500" must not
  // apply 1, 15 and 150 on the way). The slider applies live and refreshes the drafts.
  const [draft, setDraft] = useState({ min: show(min), max: show(max) });
  const [seen, setSeen] = useState({ min, max });
  if (seen.min !== min || seen.max !== max) {
    setSeen({ min, max });
    setDraft({ min: show(min), max: show(max) });
  }
  const dMin = numOrNull(draft.min);
  const dMax = numOrNull(draft.max);
  const inverted = dMin != null && dMax != null && dMin > dMax;
  const errId = `${idBase}-err`;

  const commit = () => {
    let lo = dMin;
    let hi = dMax;
    if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo]; // swap an inverted range
    setDraft({ min: show(lo), max: show(hi) });
    if (lo !== (min ?? null) || hi !== (max ?? null)) onChange(lo, hi);
  };
  const keys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  };
  const clamp = (n: number | null | undefined, fallback: number) => Math.min(R_MAX, Math.max(R_MIN, n ?? fallback));

  return (
    <FieldSection
      title={label}
      clearDisabled={min == null && max == null}
      onClear={() => {
        setDraft({ min: "", max: "" });
        onChange(null, null);
      }}
    >
      <Slider
        min={R_MIN}
        max={R_MAX}
        step={25}
        value={[clamp(min, R_MIN), clamp(max, R_MAX)]}
        onValueChange={([lo, hi]) => onChange(lo <= R_MIN ? null : lo, hi >= R_MAX ? null : hi)}
        aria-label={label}
      />
      <div aria-hidden className="-mt-1 flex justify-between font-mono text-[11px] text-muted-foreground tabular-nums">
        <span>{R_MIN}</span>
        <span>{R_MAX}+</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={`${idBase}-min`}
          type="number"
          inputMode="numeric"
          placeholder="Min"
          aria-label={`${label} minimum`}
          aria-invalid={inverted || undefined}
          aria-describedby={inverted ? errId : undefined}
          value={draft.min}
          onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))}
          onBlur={commit}
          onKeyDown={keys}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          id={`${idBase}-max`}
          type="number"
          inputMode="numeric"
          placeholder="Max"
          aria-label={`${label} maximum`}
          aria-invalid={inverted || undefined}
          aria-describedby={inverted ? errId : undefined}
          value={draft.max}
          onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))}
          onBlur={commit}
          onKeyDown={keys}
        />
      </div>
      {inverted && (
        <p id={errId} role="alert" className="text-xs text-destructive">
          Min is above max. The two values will be swapped.
        </p>
      )}
    </FieldSection>
  );
}

/** A "date stamp" field: native date input (keeps the picker and a11y) under a label-caps prefix. */
function DateStamp({ label, aria, value, onChange }: { label: string; aria: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span aria-hidden className="label-caps pointer-events-none absolute top-1.5 left-2.5 text-[10px]">
        {label}
      </span>
      <Input type="date" aria-label={aria} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 pt-4 font-mono text-sm tabular-nums" />
    </div>
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
        <Button variant="outline" role="combobox" aria-label="Opponent" aria-expanded={open} className="h-9 w-full justify-between rounded-none border-b-2 border-b-rule-strong bg-card font-normal">
          <span className={opponent ? "truncate font-serif text-base italic" : "text-muted-foreground"}>{opponent || "Any opponent"}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" aria-label="Opponents">
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
                  <InkTick className={`size-4 text-ink ${opponent?.toLowerCase() === n.toLowerCase() ? "opacity-100" : "opacity-0"}`} />
                  <span className="font-serif italic">{n}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function RawTimeControl({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  // Trimmed only when applied, so a space typed in the middle is never swallowed.
  const commit = () => {
    const v = draft.trim();
    setDraft(v);
    if (v !== value) onCommit(v);
  };
  return (
    <Input
      placeholder="Raw time control, e.g. 180+2"
      aria-label="Raw time control"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
    />
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
  // ISO dates compare as strings; an inverted range is swapped instead of matching nothing.
  const patchDates = (from: string | null, to: string | null) =>
    patch(from && to && from > to ? { date_preset: null, date_from: to, date_to: from } : { date_preset: null, date_from: from, date_to: to });

  return (
    <Sheet open={open} onOpenChange={(o) => setUi({ filtersOpen: o })}>
      {/* An index card taped to the desk: card stock with a red head rule, two strips of tape across its edges. */}
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className="paper-scope sheet-paper max-h-[88dvh] gap-0 border-0 before:hidden lg:inset-y-4 lg:right-4 lg:h-auto lg:max-h-none lg:w-[26rem] lg:max-w-[26rem]"
      >
        <Tape variant="ochre" length={104} angle={-3} seed="card-a" className="-top-2.5 left-[9%]" />
        <Tape variant="sage" length={92} angle={2.5} seed="card-b" className="-bottom-2.5 left-[58%]" />
        <SheetHeader kicker="Sampling criteria" className="border-b-[1.5px] border-solid border-margin">
          <SheetTitle className="font-serif text-xl font-semibold tracking-tight">Filters</SheetTitle>
          <SheetDescription>Results update as you change filters. Win / Draw / Loss is from your point of view.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <FieldSection title="Result" clearDisabled={!filters.result} onClear={() => patch({ result: null })}>
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
          </FieldSection>

          <FieldSection
            title="Time control"
            clearDisabled={!filters.time_control && !filters.time_control_raw}
            onClear={() => patch({ time_control: null, time_control_raw: null })}
          >
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Time control">
              {TIME_CONTROLS.map((tc) => {
                const on = filters.time_control === tc;
                return (
                  <button
                    key={tc}
                    type="button"
                    aria-pressed={on}
                    className="inline-flex h-8 items-center gap-1 rounded-sm border border-rule-strong bg-specimen px-2.5 text-sm text-muted-foreground capitalize outline-none hover:bg-card hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-[inset_0_2px_0_0_var(--primary)]"
                    onClick={() => patch({ time_control: on ? null : tc })}
                  >
                    {on && <InkTick className="size-3.5 text-ink" />}
                    <CountedOption label={tc} />
                  </button>
                );
              })}
            </div>
            <RawTimeControl value={filters.time_control_raw ?? ""} onCommit={(v) => patch({ time_control_raw: v || null })} />
          </FieldSection>

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

          <FieldSection
            title="Date"
            clearDisabled={preset === "all"}
            onClear={() => patch({ date_preset: null, date_from: null, date_to: null })}
          >
            <ToggleGroup
              type="single"
              value={String(preset)}
              onValueChange={(v) => {
                if (!v) return;
                patch(v === "all" ? { date_preset: null, date_from: null, date_to: null } : v === "custom" ? {} : { date_preset: Number(v) as Filters["date_preset"], date_from: null, date_to: null });
              }}
              aria-label="Date presets"
              className="w-full"
            >
              {([...PRESETS, ["all", "All time"]] as const).map(([v, label]) => (
                <ToggleGroupItem key={v} value={String(v)} className="flex-1 px-1.5">
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="grid grid-cols-2 gap-2">
              <DateStamp label="From" aria="From date" value={filters.date_from ?? ""} onChange={(v) => patchDates(v || null, filters.date_to ?? null)} />
              <DateStamp label="To" aria="To date" value={filters.date_to ?? ""} onChange={(v) => patchDates(filters.date_from ?? null, v || null)} />
            </div>
          </FieldSection>

          <FieldSection title="Opponent" clearDisabled={!filters.opponent} onClear={() => patch({ opponent: null })}>
            <OpponentCombobox />
          </FieldSection>
        </div>

        <SheetFooter className="flex-row items-center">
          <Button variant="tag" size="sm" onClick={clearFilters} disabled={count === 0}>
            Clear all{count ? ` (${count})` : ""}
          </Button>
          <Button className="flex-1" onClick={() => setUi({ filtersOpen: false })}>Done</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
