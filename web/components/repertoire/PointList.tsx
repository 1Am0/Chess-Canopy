"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Color } from "@/lib/engine/types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRepertoirePage } from "@/lib/repertoire/page-store";
import { MIN_GAMES, STATUS_HINT, STATUS_LABEL, type DecisionPoint, type PointEval, type PointStatus } from "@/lib/repertoire/types";
import { STATUS_ORDER, sortForDisplay, statusOf } from "@/lib/repertoire/verdict";
import { pct } from "@/lib/format";
import { WdbBar } from "@/components/explorer/WdbBar";
import { EmptySpecimen } from "@/components/field";
import { HighlighterWash, PaperSheet, RubberStamp } from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRepertoireData } from "@/components/repertoire/repertoire-data";
import { useOpening } from "@/components/repertoire/use-opening";
import { VerdictChip } from "@/components/repertoire/VerdictChip";
import { lineTail, moveNumberLabel, shortDate, usageStats } from "@/components/repertoire/format";

/** Show a report position on the board; on phones (board above the list) bring the board into view. */
export function useSelectPosition() {
  const select = useRepertoirePage((s) => s.select);
  const wide = useMediaQuery("(min-width: 1024px)");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (epd: string | null, line: string[]) => {
    select(epd, line);
    if (!wide) document.getElementById("repertoire-board")?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  };
}

function PointRow({ point, side, ev, selected, onSelect }: { point: DecisionPoint; side: Color; ev: PointEval | undefined; selected: boolean; onSelect: () => void }) {
  const opening = useOpening(point.line);
  const tail = lineTail(point.line);
  return (
    <li className="border-b border-rule last:border-b-0">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        title={tail.full}
        className="group/row relative isolate flex w-full min-w-0 flex-col gap-1.5 px-3 py-2.5 text-left outline-none hover:bg-specimen/60 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {selected && <HighlighterWash fill seed={point.epd} />}
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="w-9 shrink-0 font-mono text-xs text-pencil tabular-nums">{moveNumberLabel(point.moveNumber, side)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-sm text-ink">{tail.short}</span>
            {opening && <span className="block truncate font-serif text-sm text-muted-foreground italic">{opening.name}</span>}
          </span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
            {point.games} {point.games === 1 ? "game" : "games"}
          </span>
        </span>
        {(point.locked || point.switch) && (
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pl-11 text-xs">
            {point.locked && (
              <RubberStamp size="sm" variant="single" seed={point.epd} rotate={-1}>
                Locked {point.locked}
              </RubberStamp>
            )}
            {point.switch && (
              <span className="text-muted-foreground">
                Switched from <span className="font-mono text-ink">{point.switch.from}</span> to <span className="font-mono text-ink">{point.switch.to}</span> on{" "}
                {shortDate(point.switch.date)}
              </span>
            )}
          </span>
        )}
        <span className="grid min-w-0 grid-cols-[3.5rem_2rem_2.75rem_minmax(0,1fr)_4.25rem] items-center gap-x-2 gap-y-1 pl-11 max-sm:pl-0">
          {point.moves.map((m) => (
            <span key={m.san} className="contents">
              <span className={cn("truncate font-mono text-sm", m.san === point.main ? "font-semibold text-ink" : "text-foreground")}>{m.san}</span>
              <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">{m.games}</span>
              <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">{pct(point.games ? m.games / point.games : 0)}</span>
              <WdbBar stats={usageStats(m)} side={side} labels={false} />
              <span className="flex justify-end">
                <VerdictChip ev={ev?.moves[m.san]} />
              </span>
            </span>
          ))}
        </span>
      </button>
    </li>
  );
}

function Group({
  status,
  points,
  side,
  evals,
  selectedEpd,
  onSelect,
}: {
  status: PointStatus;
  points: DecisionPoint[];
  side: Color;
  evals: Map<string, PointEval>;
  selectedEpd: string | null;
  onSelect: (p: DecisionPoint) => void;
}) {
  const collapsible = status === "settled";
  const [open, setOpen] = useState(!collapsible);
  const id = `status-${status}`;
  const count = `${points.length} ${points.length === 1 ? "position" : "positions"}`;
  return (
    <section aria-labelledby={id} className="border-t border-rule-strong first:border-t-0">
      <div className="px-3 pt-3 pb-2">
        {collapsible ? (
          <button
            type="button"
            id={id}
            aria-expanded={open}
            aria-controls={`${id}-list`}
            onClick={() => setOpen((o) => !o)}
            className="-mx-1 flex items-center gap-1.5 rounded-[2px] px-1 text-left font-serif text-lg font-semibold text-ink outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
          >
            <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground motion-safe:transition-transform", !open && "-rotate-90")} />
            <span>
              {STATUS_LABEL[status]} <span className="font-sans text-sm font-normal text-muted-foreground">· <span className="font-mono text-xs tabular-nums">{count}</span> · leave these alone</span>
            </span>
          </button>
        ) : (
          <h3 id={id} className="flex items-baseline gap-2 font-serif text-lg font-semibold text-ink">
            {STATUS_LABEL[status]}
            <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">{count}</span>
          </h3>
        )}
        <p className="text-sm text-muted-foreground">{STATUS_HINT[status]}</p>
      </div>
      {open && (
        <ul id={`${id}-list`} className="border-t border-rule">
          {points.map((p) => (
            <PointRow key={p.epd} point={p} side={side} ev={evals.get(p.epd)} selected={p.epd === selectedEpd} onSelect={() => onSelect(p)} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Loading placeholder for the list: pencilled rows. */
export function PointListSkeleton() {
  return (
    <PaperSheet className="flex flex-col gap-3 p-3" aria-busy="true" aria-label="Loading positions">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </PaperSheet>
  );
}

/** The report positions, most urgent first, in one group per status. */
export function PointList() {
  const { report, evals, side } = useRepertoireData();
  const selectedEpd = useRepertoirePage((s) => s.selectedEpd);
  const selectPosition = useSelectPosition();

  const groups = useMemo(() => {
    if (!report) return [];
    const sorted = sortForDisplay(report.points, evals);
    const by = new Map<PointStatus, DecisionPoint[]>();
    for (const p of sorted) {
      const s = statusOf(p, evals.get(p.epd));
      const list = by.get(s);
      if (list) list.push(p);
      else by.set(s, [p]);
    }
    return STATUS_ORDER.filter((s) => by.has(s)).map((s) => ({ status: s, points: by.get(s)! }));
  }, [report, evals]);

  if (!report) return null;
  return (
    <PaperSheet as="section" aria-label="Positions" className="min-w-0">
      {groups.length === 0 ? (
        <EmptySpecimen title="No repeated positions yet" hint={`Positions you reached at least ${MIN_GAMES} times with this side show up here.`} />
      ) : (
        groups.map((g) => (
          <Group
            key={g.status}
            status={g.status}
            points={g.points}
            side={side}
            evals={evals}
            selectedEpd={selectedEpd}
            onSelect={(p) => selectPosition(p.epd, p.line)}
          />
        ))
      )}
    </PaperSheet>
  );
}
