"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import type { NextMove } from "@/lib/engine/types";
import { activeFilterCount, isResultFresh, loadFailed, useExplorerStore } from "@/lib/store";
import { compact, pct, score } from "@/lib/format";
import { lookupOpening } from "@/lib/openings/lookup";
import { usePosition } from "@/hooks/use-position";
import { COL, MoveRow } from "@/components/explorer/MoveRow";
import { splitRare } from "@/components/explorer/rare";
import { WdbBar } from "@/components/explorer/WdbBar";
import { scoreTextClass } from "@/components/explorer/wdb";
import { EmptyState } from "@/components/field";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SortKey = "games" | "score" | "move";

/** Sticky header (28px) and sticky total row (32px) heights, for keeping rows in view. */
const HEAD_PX = 28;
const FOOT_PX = 32;
const NO_ROWS: NextMove[] = [];

/**
 * The Moves tab: a scroll region with a sticky header and a sticky Σ total row
 * (Lichess explorer style). Every row is a single 32px line. Rare moves, the loading
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
  const [showRare, setShowRare] = useState(false);
  const [seenKey, setSeenKey] = useState(posKey);

  // Reset transient state when the position changes (adjust-during-render pattern).
  if (seenKey !== posKey) {
    setSeenKey(posKey);
    setShowRare(false);
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

  const { common, rare } = useMemo(() => splitRare(sorted, total), [sorted, total]);

  const rows = showRare ? [...common, ...rare] : common;
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
          "-mx-1 inline-flex min-h-6 min-w-6 items-center gap-1 whitespace-nowrap px-1 outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-ring",
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
        {sort.key === k && (sort.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
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
        "@container relative h-full min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]",
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
        className="w-full table-fixed border-separate border-spacing-0 text-left text-sm outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring/60"
      >
        <thead className="sticky top-0 z-10">
          <tr className="h-7 text-muted-foreground bg-card text-[13px] [&>th]:border-b [&>th]:border-border">
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
        <tbody className={cn("transition-opacity duration-200", busy && "pointer-events-none opacity-50")}>
          {firstLoad &&
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="h-8">
                <td className={COL.move}><Skeleton className="h-4 w-10" /></td>
                <td className={COL.games}><Skeleton className="ml-auto h-4 w-8" /></td>
                <td className={COL.share}><Skeleton className="ml-auto h-4 w-7" /></td>
                <td className={COL.bar}><Skeleton className="h-4 w-full" /></td>
                <td className={COL.score}><Skeleton className="ml-auto h-4 w-8" /></td>
              </tr>
            ))}
          {!empty &&
            common.map((item, i) => <MoveRow key={item.move} {...rowProps(item, i)} />)}
          {!empty && rare.length > 0 && (
            <tr className="h-8">
              {([["@sm:hidden", 4], ["hidden @sm:table-cell", 5]] as const).map(([cls, span]) => (
                <td key={span} colSpan={span} className={cn("border-b border-border p-0", cls)}>
                  <button
                    type="button"
                    aria-expanded={showRare}
                    onClick={() => setShowRare((v) => !v)}
                    className="flex h-8 w-full items-center justify-center gap-1.5 px-3 text-sm leading-none text-muted-foreground outline-none hover:bg-secondary hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    {showRare ? "Hide" : "Show"} {rare.length} rare {rare.length === 1 ? "move" : "moves"}
                    {showRare ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
                  </button>
                </td>
              ))}
            </tr>
          )}
          {!empty && showRare && rare.map((item, j) => <MoveRow key={item.move} {...rowProps(item, common.length + j, true)} />)}
        </tbody>
        {result && !empty && (
          <tfoot className="sticky bottom-0 z-10">
            <tr className="h-8 bg-card font-semibold [&>td]:border-t [&>td]:border-border">
              <td className={COL.move}>
                <span className="text-base text-ink" aria-label="Total">Σ</span>
              </td>
              <td className={cn(COL.games, "text-[13px]")}>{compact(total)}</td>
              <td className={cn(COL.share, "text-xs font-normal text-muted-foreground")}>100%</td>
              <td className={COL.bar}>
                <WdbBar stats={result.stats} side={side} />
              </td>
              <td className={cn(COL.score, "text-[13px]", scoreTextClass(sc, total))}>{total ? pct(sc) : "–"}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {failed && (
        <div className="absolute inset-x-0 top-7 bottom-0 flex items-center justify-center overflow-hidden" role="alert">
          <EmptyState
            className="py-2"
            title="Couldn't load your games"
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
            <EmptyState
              className="py-2"
              title={`No games as ${side === "white" ? "White" : "Black"}`}
              action={
                <Button size="sm" variant="outline" onClick={() => setSide(other)}>
                  View as {other === "white" ? "White" : "Black"} ({otherCount.toLocaleString()} {otherCount === 1 ? "game" : "games"})
                </Button>
              }
            />
          ) : noGames ? (
            <EmptyState
              className="py-2"
              title="No games match these filters"
              action={<Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              className="py-2"
              title={outOfBook ? (total > 0 ? "Your games end here" : "No games reach this position.") : "No moves found"}
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

  function rowProps(item: NextMove, i: number, isRare = false) {
    return {
      id: `move-row-${i}`,
      item,
      side,
      positionTotal: total,
      active: focused && i === idx,
      openingName: openingFor(item.move),
      rare: isRare,
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
