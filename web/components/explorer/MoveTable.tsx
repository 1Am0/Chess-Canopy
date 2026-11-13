"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import type { NextMove } from "@/lib/engine/types";
import { activeFilterCount, isResultFresh, loadFailed, useExplorerStore } from "@/lib/store";
import { compact, pct, score } from "@/lib/format";
import { shareLabel } from "@/lib/explorer-format";
import { lookupOpening } from "@/lib/openings/lookup";
import { usePosition } from "@/hooks/use-position";
import { COL, MoveRow, ScoreChip } from "@/components/explorer/MoveRow";
import { WdbBar } from "@/components/explorer/WdbBar";
import { CountUp } from "@/components/explorer/useCountUp";
import { useElementSize } from "@/components/paper/use-size";
import { EmptySpecimen } from "@/components/field";
import { InkArrow } from "@/components/explorer/ink";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SortKey = "games" | "score" | "move";

/** Sticky header (28px) and sticky total row (32px) heights, for keeping rows in view. */
const HEAD_PX = 28;
const FOOT_PX = 40;
const NO_ROWS: NextMove[] = [];

/**
 * The move table: a scroll region with a sticky header and a sticky Σ total row
 * (Lichess explorer style). Every row is a fixed 40px line. The loading
 * state and the empty / out-of-book states all live inside the same region, so the
 * region's size never depends on the position.
 */
export function MoveTable({ className }: { className?: string }) {
  const result = useExplorerStore((s) => s.result);
  const summary = useExplorerStore((s) => s.summary);
  const loading = useExplorerStore((s) => s.resultLoading);
  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const playMove = useExplorerStore((s) => s.playMove);
  const setHoverMove = useExplorerStore((s) => s.setHoverMove);
  const clearFilters = useExplorerStore((s) => s.clearFilters);
  const filterCount = useExplorerStore((s) => activeFilterCount(s.filters));
  const setSide = useExplorerStore((s) => s.setSide);
  const toStart = useExplorerStore((s) => s.toStart);
  const failed = useExplorerStore(loadFailed);
  const retryLoad = useExplorerStore((s) => s.retryLoad);
  const undo = useExplorerStore((s) => s.undo);
  const { visible, key: posKey } = usePosition();
  const scroller = useRef<HTMLDivElement>(null);

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "games", dir: "desc" });
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [seenKey, setSeenKey] = useState(posKey);

  // Reset transient state when the position changes (adjust-during-render pattern).
  if (seenKey !== posKey) {
    setSeenKey(posKey);
    setActive(0);
  }

  // A new position starts at the top of the list.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [posKey]);

  // The rows belong to the position the result was computed for. While a new result is
  // pending (or the shown one is for another position) rows stay visible but inert, so
  // a double click can't play a move from a stale table.
  const fresh = useExplorerStore(isResultFresh);
  const inert = loading || !fresh;
  const next = result?.next ?? NO_ROWS;
  const total = result?.stats.total ?? 0;
  const currentName = useMemo(() => lookupOpening(visible)?.name ?? null, [visible]);

  const sorted = useMemo(() => {
    const out = [...next];
    const m = sort.dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      if (sort.key === "move") return m * a.move.localeCompare(b.move);
      if (sort.key === "score") return m * (score(a.stats) - score(b.stats)) || b.stats.total - a.stats.total;
      return m * (a.stats.total - b.stats.total) || a.move.localeCompare(b.move);
    });
    return out;
  }, [next, sort]);

  const rows = sorted;
  const idx = Math.min(active, Math.max(rows.length - 1, 0));

  // Keep the keyboard-selected row visible between the sticky header and total row.
  useEffect(() => {
    const box = scroller.current;
    if (!box || !focused) return;
    const el = box.querySelector<HTMLElement>(`#move-row-${idx}`);
    if (!el) return;
    const top = el.offsetTop;
    if (top - HEAD_PX < box.scrollTop) box.scrollTop = top - HEAD_PX;
    else if (top + el.offsetHeight + FOOT_PX > box.scrollTop + box.clientHeight) box.scrollTop = top + el.offsetHeight + FOOT_PX - box.clientHeight;
  }, [idx, focused]);

  const openingFor = (san: string) => {
    const name = lookupOpening([...visible, san])?.name ?? null;
    return name && name !== currentName ? name : null;
  };

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "move" ? "asc" : "desc" }));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget || !rows.length) return;
    if (inert && e.key === "Enter") {
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const n = Math.min(idx + 1, rows.length - 1);
      setActive(n);
      setHoverMove(rows[n].move);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const n = Math.max(idx - 1, 0);
      setActive(n);
      setHoverMove(rows[n].move);
    } else if (e.key === "Enter") {
      e.preventDefault();
      playMove(rows[idx].move);
      setActive(0);
    }
  };

  const Th = ({ k, label, short, className }: { k: SortKey; label: string; short?: string; className?: string }) => (
    <th scope="col" className={cn("font-medium", className)} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => toggle(k)}
        className={cn(
          "-mx-1 inline-flex min-h-6 min-w-6 items-center gap-1 whitespace-nowrap px-1 outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[-1px] focus-visible:outline-ring",
          sort.key === k && "text-ink",
        )}
      >
        {short ? (
          <>
            <span className="sr-only @xs:not-sr-only">{label}</span>
            <span aria-hidden className="@xs:hidden">{short}</span>
          </>
        ) : (
          label
        )}
        {sort.key === k && <InkArrow dir={sort.dir === "asc" ? "up" : "down"} />}
      </button>
    </th>
  );

  const firstLoad = !result && !failed;
  const noGames = !!summary && summary.games === 0;
  const empty = !firstLoad && !failed && (noGames || next.length === 0);
  const outOfBook = visible.length > 0;
  const busy = inert && !firstLoad;
  const other = side === "white" ? "black" : "white";
  const otherCount = summary?.counts[other] ?? 0;
  const sc = result ? score(result.stats) : 0;

  return (
    <div
      ref={scroller}
      data-testid="move-table-scroller"
      className={cn(
        "@container relative flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]",
        className,
      )}
    >
      <table
        role="grid"
        data-local-keys
        tabIndex={0}
        aria-label="Candidate moves. Use up and down arrows to select, Enter to play."
        aria-activedescendant={focused && rows.length && !empty ? `move-row-${idx}` : undefined}
        aria-busy={inert}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          if (e.target === e.currentTarget) setFocused(true);
        }}
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
            if (e.target === e.currentTarget) setFocused(false);
            return;
          }
          setFocused(false);
          setHoverMove(null);
        }}
        className="w-full shrink-0 table-fixed border-separate border-spacing-0 text-left text-sm outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring/60"
      >
        <thead className="sticky top-0 z-10">
          <tr className="label-caps h-7 bg-card text-[11px] text-pencil [&>th]:border-b [&>th]:border-rule-strong">
            <Th k="move" label="Move" className={COL.move} />
            <Th k="games" label="Games" short="G" className={COL.games} />
            <th scope="col" className={cn(COL.share, "font-medium")}>Share</th>
            <th scope="col" className={cn(COL.bar, "font-medium whitespace-nowrap")}>
              <span className="hidden @[22rem]:inline">White / Draw / Black</span>
              <span className="@[22rem]:hidden">W / D / B</span>
            </th>
            <Th k="score" label="Score" className={COL.score} />
          </tr>
        </thead>
        <tbody className={cn("ledger-body transition-opacity duration-200", busy && "pointer-events-none opacity-50")}>
          {firstLoad &&
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="h-10">
                <td className={COL.move}><Skeleton className="h-4 w-10" /></td>
                <td className={COL.games}><Skeleton className="ml-auto h-4 w-8" /></td>
                <td className={COL.share}><Skeleton className="ml-auto h-4 w-7" /></td>
                <td className={COL.bar}><Skeleton className="h-4 w-full" /></td>
                <td className={COL.score}><Skeleton className="ml-auto h-4 w-8" /></td>
              </tr>
            ))}
          {!empty &&
            rows.map((item, i) => <MoveRow key={`${posKey}-${item.move}`} {...rowProps(item, i)} />)}
        </tbody>
        {result && !empty && (
          <tfoot className="sticky bottom-0 z-10">
            <tr className="h-10 bg-card font-semibold [&>td]:border-t-[3px] [&>td]:border-double [&>td]:border-pencil">
              <td className={COL.move} title="All moves from this position">
                <span className="inline-flex items-baseline gap-1.5">
                  <span className="font-serif text-base text-ink" aria-label="Total">Σ</span>
                  <span aria-hidden className="hidden font-serif text-xs font-normal text-muted-foreground italic @xs:inline">all moves</span>
                </span>
              </td>
              <td className={cn(COL.games, "text-sm")}>
                <CountUp value={total} format={compact} />
              </td>
              <td className={cn(COL.share, "text-xs font-normal text-muted-foreground")}>100%</td>
              <td className={COL.bar}>
                <WdbBar key={`${total}-${result.stats.wins}-${result.stats.draws}-${side}`} stats={result.stats} side={side} seed="total" />
              </td>
              <td className={cn(COL.score, "text-sm")}>
                <ScoreChip sc={sc} total={total} />
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {!firstLoad && !failed && !empty && result && (
        <FieldNote rows={next} total={total} sc={sc} />
      )}

      {failed && (
        <div className="absolute inset-x-0 top-7 bottom-0 flex items-center justify-center overflow-hidden" role="alert">
          <EmptySpecimen
            className="py-2"
            title="Couldn't load your games"
            hint="Something went wrong while reading the saved games. Try again."
            action={
              <Button size="sm" variant="outline" onClick={retryLoad}>
                <RotateCcw /> Retry
              </Button>
            }
          />
        </div>
      )}

      {empty && (
        <div className="absolute inset-x-0 top-7 bottom-0 flex items-center justify-center overflow-hidden">
          {noGames && filterCount === 0 && otherCount > 0 ? (
            <EmptySpecimen
              className="py-2"
              title={`No games as ${side === "white" ? "White" : "Black"}`}
              hint="This selection only has games with the other color."
              action={
                <Button size="sm" variant="outline" onClick={() => setSide(other)}>
                  View as {other === "white" ? "White" : "Black"} ({otherCount.toLocaleString()} {otherCount === 1 ? "game" : "games"})
                </Button>
              }
            />
          ) : noGames ? (
            <EmptySpecimen
              className="py-2"
              title="No games match these filters"
              hint="Loosen or clear the filters to see your moves."
              action={<Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptySpecimen
              className="py-2"
              title={outOfBook ? "No specimens collected here" : "No moves found"}
              hint={
                outOfBook
                  ? total > 0
                    ? "Your games end here. No further moves were played from this position."
                    : "None of your games reached this position."
                  : "There are no games for the current selection."
              }
              action={
                outOfBook ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={undo}><Undo2 /> Step back</Button>
                    <Button size="sm" variant="outline" onClick={toStart}><RotateCcw /> Start</Button>
                  </div>
                ) : undefined
              }
            />
          )}
        </div>
      )}
    </div>
  );

  function rowProps(item: NextMove, i: number) {
    return {
      id: `move-row-${i}`,
      index: i,
      item,
      side,
      positionTotal: total,
      active: focused && i === idx,
      openingName: openingFor(item.move),
      onPlay: () => {
        if (inert) return;
        playMove(item.move);
        setActive(0);
      },
      onHover: (h: boolean) => {
        setHoverMove(h ? item.move : null);
        if (h) setActive(i);
      },
    };
  }
}

/**
 * The empty area under a short table: ruled like the ledger, with a pencilled note about this position. It takes
 * the space the rows leave (flex-1, zero when the rows fill the region), so it never changes any slot size. Lines
 * are shown only as far as they fit whole.
 */
function FieldNote({ rows, total, sc }: { rows: NextMove[]; total: number; sc: number }) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const top = rows.reduce<NextMove | null>((a, r) => (!a || r.stats.total > a.stats.total ? r : a), null);
  const best = rows
    .filter((r) => r.stats.total >= 3)
    .reduce<NextMove | null>((a, r) => (!a || score(r.stats) > score(a.stats) ? r : a), null);
  const lines: React.ReactNode[] = [
    <>
      <b className="font-mono font-semibold text-ink">{total.toLocaleString("en-US")}</b> {total === 1 ? "game reaches" : "games reach"} this position; you score{" "}
      <b className="font-mono font-semibold text-ink">{pct(sc)}</b>.
    </>,
  ];
  if (top)
    lines.push(
      <>
        Most played: <b className="font-mono font-semibold text-ink">{top.move}</b>, {shareLabel(top.stats.total, total)} of games.
      </>,
    );
  if (best && top && best.move !== top.move && rows.length > 1)
    lines.push(
      <>
        Best result: <b className="font-mono font-semibold text-ink">{best.move}</b>, {pct(score(best.stats))} over {best.stats.total} games.
      </>,
    );
  lines.push("Click a move to play it, or use the arrow keys and Enter.");
  const fit = size ? Math.max(0, Math.floor((size.h - 44) / 24)) : 0;
  return (
    <div ref={ref} aria-hidden className="ledger-void relative min-h-0 flex-1 overflow-hidden">
      {fit > 0 && (
        <div className="field-note absolute top-3 right-3 left-5 max-w-[26rem]">
          <p className="origin-left -rotate-1 font-hand text-xl leading-6 text-pencil">Field note</p>
          <ul className="mt-1 font-serif text-sm leading-6 text-pencil italic">
            {lines.slice(0, fit).map((l, i) => (
              <li key={i} className="truncate [&_b]:not-italic">{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
