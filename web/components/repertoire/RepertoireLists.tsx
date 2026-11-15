"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Lock } from "lucide-react";
import type { Color } from "@/lib/engine/types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRepertoirePage } from "@/lib/repertoire/page-store";
import { MIN_GAMES, STATUS_HINT, STATUS_LABEL, type DecisionPoint, type PointEval, type PointStatus } from "@/lib/repertoire/types";
import { STATUS_ORDER, sortForDisplay, statusOf } from "@/lib/repertoire/verdict";
import { PencilTick } from "@/components/explorer/ink";
import { EmptySpecimen } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRepertoireData } from "@/components/repertoire/repertoire-data";
import { useOpening } from "@/components/repertoire/use-opening";
import { VerdictChip } from "@/components/repertoire/VerdictChip";
import { lineTail, moveNumberLabel, shortDate } from "@/components/repertoire/format";

type Tab = "positions" | "repertoire" | "left";

/** Show a report position on the board; on phones (board above the sheet) bring the board into view. */
function useSelectPosition() {
  const select = useRepertoirePage((s) => s.select);
  const wide = useMediaQuery("(min-width: 1024px)");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (epd: string | null, line: string[]) => {
    select(epd, line);
    if (!wide) document.getElementById("repertoire-board")?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  };
}

// GamesList's 40px ledger row (every row of these lists, group headers included, is 40px so the ledger stripes line up); selection is the explorer's active-row marker (highlighter band and pencil tick).
const row =
  "group/row relative isolate flex h-10 w-full min-w-0 items-center gap-3 pr-3 pl-4 text-left outline-none hover:bg-specimen/60 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring";

/** The explorer's active-row marker for a list row (the CSS only reveals it on table rows, so it is switched on here). */
function RowMark({ on, seed }: { on: boolean; seed: string }) {
  if (!on) return null;
  return (
    <>
      <span aria-hidden className="row-wash" style={{ transform: "scaleX(1)" }} />
      <PencilTick seed={seed} className="absolute top-1/2 left-1 -translate-y-1/2" />
    </>
  );
}

function PointRow({ point, side, ev, selected, onSelect }: { point: DecisionPoint; side: Color; ev: PointEval | undefined; selected: boolean; onSelect: () => void }) {
  const opening = useOpening(point.line);
  const tail = lineTail(point.line);
  return (
    <li>
      <button type="button" onClick={onSelect} aria-current={selected ? "true" : undefined} title={tail.full} className={cn(row, "border-b border-rule")}>
        <RowMark on={selected} seed={point.epd} />
        <span className="w-8 shrink-0 font-mono text-xs text-pencil tabular-nums">{moveNumberLabel(point.moveNumber, side)}</span>
        <span className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
          <span className="truncate font-mono text-sm text-ink">{tail.short}</span>
          {opening && <span className="truncate font-serif text-xs text-muted-foreground italic">{opening.name}</span>}
        </span>
        <span className="shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
          {point.games}
          <span className="hidden @xs:inline"> {point.games === 1 ? "game" : "games"}</span>
        </span>
        <span className="flex w-[6.5rem] shrink-0 items-center justify-end gap-1.5">
          <span className="truncate font-mono text-sm font-semibold text-ink">{point.main}</span>
          <VerdictChip ev={ev?.moves[point.main]} />
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
  const head = (
    <>
      <span className="label-caps truncate text-[11px] text-pencil">{STATUS_LABEL[status]}</span>
      <span className="font-mono text-xs text-ink tabular-nums">{points.length}</span>
    </>
  );
  return (
    <li aria-labelledby={id} role="group">
      {collapsible ? (
        <button
          type="button"
          id={id}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          title={STATUS_HINT[status]}
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 w-full min-w-0 items-center gap-2 border-b border-rule px-3 text-left outline-none hover:bg-specimen/60 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <ChevronDown aria-hidden className={cn("size-3.5 shrink-0 text-muted-foreground motion-safe:transition-transform", !open && "-rotate-90")} />
          {head}
        </button>
      ) : (
        <h4 id={id} title={STATUS_HINT[status]} className="flex h-10 min-w-0 items-center gap-2 border-b border-rule px-3">
          {head}
        </h4>
      )}
      {open && (
        <ul id={`${id}-list`}>
          {points.map((p) => (
            <PointRow key={p.epd} point={p} side={side} ev={evals.get(p.epd)} selected={p.epd === selectedEpd} onSelect={() => onSelect(p)} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** The report positions, most urgent first, in one group per status. */
function Positions() {
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

  if (groups.length === 0) {
    return <EmptySpecimen className="py-4" title="No repeated positions yet" hint={`Positions you reached at least ${MIN_GAMES} times with this side show up here.`} />;
  }
  return (
    <ul aria-label="Positions">
      {groups.map((g) => (
        <Group
          key={g.status}
          status={g.status}
          points={g.points}
          side={side}
          evals={evals}
          selectedEpd={selectedEpd}
          onSelect={(p) => selectPosition(p.epd, p.line)}
        />
      ))}
    </ul>
  );
}

/** Your saved moves on this side: the line, the move and an unlock button; a click shows the position on the board. */
function YourRepertoire() {
  const { entries, pointsByEpd, busy, unlock } = useRepertoireData();
  const selectedEpd = useRepertoirePage((s) => s.selectedEpd);
  const selectPosition = useSelectPosition();
  const sorted = [...entries].sort((a, b) => a.line.length - b.line.length || a.line.join(" ").localeCompare(b.line.join(" ")));

  if (sorted.length === 0) {
    return <EmptySpecimen className="py-4" title="No moves locked in yet" hint="Pick a position above and lock in the move you want to play there." />;
  }
  return (
    <ul aria-label="Your repertoire">
      {sorted.map((e) => {
        const tail = lineTail(e.line);
        const reached = pointsByEpd.has(e.epd);
        const selected = e.epd === selectedEpd;
        return (
          <li key={e.id} className="flex h-10 items-center border-b border-rule pr-2">
            <button type="button" className={cn(row, "h-full")} title={tail.full} aria-current={selected ? "true" : undefined} onClick={() => selectPosition(e.epd, e.line)}>
              <RowMark on={selected} seed={e.id} />
              <span className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
                <span className="truncate font-mono text-sm text-ink">{tail.short}</span>
                {!reached && <span className="truncate text-xs text-muted-foreground">Not in your games yet</span>}
              </span>
              <span className="shrink-0 font-mono text-sm font-semibold text-ink">{e.san}</span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-ink"
              disabled={busy}
              onClick={() => void unlock(e.epd, e.san)}
              aria-label={`Unlock ${e.san}`}
              title={`Unlock ${e.san}`}
            >
              <Lock />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Games since a move was locked in where you played something else, in GamesList's rows. */
function LeftRepertoire() {
  const { report } = useRepertoireData();
  const list = report?.deviations ?? [];
  if (list.length === 0) {
    return <EmptySpecimen className="py-4" title="No games left your repertoire" hint="Games where you played something other than your locked move show up here." />;
  }
  return (
    <ul aria-label="Left your repertoire">
      {list.map((d, i) => {
        const opp = d.game.opponent || "Unknown";
        const rating = d.game.opponent_rating != null ? ` (${d.game.opponent_rating})` : "";
        const tail = lineTail(d.line);
        const body = (
          <>
            <span className="w-[5.5rem] shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{shortDate(d.game.date)}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink">
              <span className="font-medium">{opp}</span>
              <span className="text-muted-foreground tabular-nums">{rating}</span>
            </span>
            <span className="min-w-0 shrink truncate text-xs text-muted-foreground">
              played <span className="font-mono font-semibold text-ink">{d.played}</span> instead of <span className="font-mono font-semibold text-ink">{d.expected}</span>
            </span>
            <span className="w-4 shrink-0 text-muted-foreground">{d.game.url && <ExternalLink aria-hidden className="size-3.5" />}</span>
          </>
        );
        const cls = "row-in group/row relative flex h-10 items-center gap-3 border-b border-rule pr-3 pl-4";
        return (
          <li key={`${d.game.game_id}-${i}`} style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }} className="row-in">
            {d.game.url ? (
              <a
                href={d.game.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open the game against ${opp}: ${tail.full}`}
                className={cn(cls, "outline-none hover:bg-specimen/60 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring")}
              >
                {body}
              </a>
            ) : (
              <div className={cls} title={tail.full}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Loading placeholder: pencilled 40px rows. */
function ListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex h-10 items-center gap-3 border-b border-rule pr-3 pl-4">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

/**
 * Under the split handle, in GamesList's place: a header line with three list buttons (positions, your repertoire, the
 * games that left it) and the engine's progress, over the chosen list, which scrolls inside the pane.
 */
export function RepertoireLists() {
  const { report, stale, entries, evalDone, evalTotal, evalRunning } = useRepertoireData();
  const [tab, setTab] = useState<Tab>("positions");
  const shown = stale ? null : report;
  const tabs: { id: Tab; label: string; count: number | null }[] = [
    { id: "positions", label: "Positions", count: shown ? shown.points.length : null },
    { id: "repertoire", label: "Your repertoire", count: entries.length },
    { id: "left", label: "Left your repertoire", count: shown ? shown.deviations.length : null },
  ];

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-rule-strong px-3">
        <div
          role="group"
          aria-label="Lists"
          className="-ml-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-2 px-1 outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[-1px] focus-visible:outline-ring",
                  on && "underline decoration-ink/40 underline-offset-[5px]",
                )}
              >
                <span className={cn("label-caps text-[11px]", on ? "text-ink" : "text-pencil")}>{t.label}</span>
                <span className={cn("font-mono text-xs tabular-nums", on ? "text-ink" : "text-muted-foreground")}>{t.count ?? "–"}</span>
              </button>
            );
          })}
        </div>
        <span aria-live="polite" className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {evalRunning && evalTotal > 0 ? `Engine ${evalDone}/${evalTotal}` : ""}
        </span>
      </div>
      <div
        role="region"
        aria-label={tabs.find((t) => t.id === tab)!.label}
        className="ledger-body min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
      >
        {!shown && tab !== "repertoire" ? <ListSkeleton /> : tab === "positions" ? <Positions /> : tab === "repertoire" ? <YourRepertoire /> : <LeftRepertoire />}
      </div>
    </div>
  );
}
