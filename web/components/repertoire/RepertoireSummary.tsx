"use client";

import { useMemo } from "react";
import type { Color } from "@/lib/engine/types";
import { useExplorerStore } from "@/lib/store";
import { useRepertoirePage } from "@/lib/repertoire/page-store";
import { MAX_MOVE_CHOICES, PERIOD_CHOICES, STATUS_LABEL, type PointStatus } from "@/lib/repertoire/types";
import { STATUS_ORDER, statusOf } from "@/lib/repertoire/verdict";
import { PencilUnderline } from "@/components/explorer/ink";
import { CountedOption } from "@/components/field";
import { PaperSheet, Tape, UnderSheet } from "@/components/paper";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useRepertoireData } from "@/components/repertoire/repertoire-data";
import { capitalize } from "@/components/repertoire/format";

const SIDES: { id: Color; label: string; glyph: string }[] = [
  { id: "white", label: "White", glyph: "♔" },
  { id: "black", label: "Black", glyph: "♚" },
];

/** The explorer's White | Black index-card tabs (SideSwitch), without its game counts (the explorer's summary is not loaded here). */
function RepertoireSideSwitch() {
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

/** Top of the report column: side, time control, depth, how many games, the status tally and the engine's progress. */
export function RepertoireSummary() {
  const { report, stale, evals, evalDone, evalTotal, evalRunning } = useRepertoireData();
  const setTimeControl = useRepertoirePage((s) => s.setTimeControl);
  const maxMove = useRepertoirePage((s) => s.maxMove);
  const setMaxMove = useRepertoirePage((s) => s.setMaxMove);
  const periodDays = useRepertoirePage((s) => s.periodDays);
  const setPeriodDays = useRepertoirePage((s) => s.setPeriodDays);
  const shown = stale ? null : report;

  const tally = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<PointStatus, number>;
    for (const p of shown?.points ?? []) counts[statusOf(p, evals.get(p.epd))]++;
    return counts;
  }, [shown, evals]);

  const allGames = (report?.timeControls ?? []).reduce((n, t) => n + t.games, 0);

  return (
    <div className="relative isolate z-10 min-w-0">
      <UnderSheet seed={7} dx={7} dy={8} rotate={-1} />
      <PaperSheet as="section" aria-label="Summary" className="flex min-w-0 flex-col gap-3 p-3 pt-4">
        <Tape variant="ochre" angle={-3} seed="top-l" className="-top-1.5 left-6" />
        <Tape variant="ochre" angle={2.5} seed="top-r" className="-top-1.5 right-6" />
        <RepertoireSideSwitch />

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h1 className="font-serif text-2xl leading-tight font-semibold tracking-tight text-ink">Repertoire</h1>
          <div className="font-mono text-sm text-ink tabular-nums" data-testid="games-analysed">
            {shown ? `${shown.games.toLocaleString("en-US")} games analysed` : <Skeleton className="h-5 w-36" />}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="label-caps text-[11px] text-pencil">Time control</h2>
          <div role="group" aria-label="Time control" className="flex flex-wrap gap-1.5">
            {report ? (
              <>
                {report.timeControls.map((t) => (
                  <Button
                    key={t.timeControl}
                    variant="outline"
                    size="sm"
                    aria-pressed={report.timeControl === t.timeControl}
                    onClick={() => setTimeControl(t.timeControl)}
                    className="max-sm:h-10"
                  >
                    <CountedOption label={capitalize(t.timeControl)} count={t.games} />
                  </Button>
                ))}
                <Button variant="outline" size="sm" aria-pressed={report.timeControl === null} onClick={() => setTimeControl(null)} className="max-sm:h-10">
                  <CountedOption label="All" count={allGames} />
                </Button>
              </>
            ) : (
              <Skeleton className="h-8 w-64" />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h2 className="label-caps text-[11px] text-pencil" id="period-label">
            Period
          </h2>
          <Select value={periodDays === null ? "all" : String(periodDays)} onValueChange={(v) => setPeriodDays(v === "all" ? null : Number(v))}>
            <SelectTrigger aria-labelledby="period-label" className="h-8 w-auto min-w-40 max-sm:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_CHOICES.map((c) => (
                <SelectItem key={c.label} value={c.days === null ? "all" : String(c.days)}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <h2 className="label-caps text-[11px] text-pencil" id="depth-label">
            Depth
          </h2>
          <Select value={String(maxMove)} onValueChange={(v) => setMaxMove(Number(v))}>
            <SelectTrigger aria-labelledby="depth-label" className="h-8 w-auto min-w-40 max-sm:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAX_MOVE_CHOICES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Up to move {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ul aria-label="Positions by status" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-rule pt-2.5 text-sm">
          {STATUS_ORDER.map((s) => (
            <li key={s} className={cn("flex items-baseline gap-1.5", shown && tally[s] === 0 && "text-muted-foreground")}>
              <span className="font-mono font-semibold tabular-nums">{shown ? tally[s] : "–"}</span>
              <span>{STATUS_LABEL[s]}</span>
            </li>
          ))}
        </ul>

        <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
          {evalRunning && evalTotal > 0 ? (
            <>
              Engine checked <span className="font-mono tabular-nums">{evalDone}</span> of <span className="font-mono tabular-nums">{evalTotal}</span> positions
            </>
          ) : null}
        </p>
      </PaperSheet>
    </div>
  );
}
