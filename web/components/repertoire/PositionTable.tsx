"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import type { MoveEval, MoveUsage, NewRepertoireEntry } from "@/lib/repertoire/types";
import { MIN_GAMES } from "@/lib/repertoire/types";
import { useRepertoirePage } from "@/lib/repertoire/page-store";
import { compact, score } from "@/lib/format";
import { shareLabel } from "@/lib/explorer-format";
import { COL, ScoreChip } from "@/components/explorer/MoveRow";
import { WdbBar } from "@/components/explorer/WdbBar";
import { PencilTick } from "@/components/explorer/ink";
import { EmptySpecimen } from "@/components/field";
import { RubberStamp } from "@/components/paper";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRepertoireData } from "@/components/repertoire/repertoire-data";
import { useHere } from "@/components/repertoire/here";
import { VerdictChip } from "@/components/repertoire/VerdictChip";
import { lossLabel, shortDate, usageStats, verdictPhrase } from "@/components/repertoire/format";

/** Sticky header height, for keeping rows in view. */
const HEAD_PX = 28;

/**
 * The explorer's columns (COL) plus the engine's eval and a lock button. The result bar is narrower than the explorer's
 * to make room for them, and left out below 24rem (phones), where the score chip carries the results.
 */
const C = {
  bar: cn(COL.bar, "hidden w-[22%] @xs:w-[22%] @sm:table-cell"),
  eval: "w-14 px-1 text-right whitespace-nowrap",
  lock: "w-9 pr-1.5 pl-0 text-right",
} as const;

type Pending = { entry: NewRepertoireEntry; ev: MoveEval };
type Row = { san: string; usage: MoveUsage | null };

/**
 * "This position": the explorer's move table for the board position, from your games. One 40px row per move you played
 * here (most games first) with your results, the engine's eval and a lock; the locked move is listed even when you never
 * played it. A row plays its move on the board. Locking a move the engine dislikes asks once more, in a strip at the
 * bottom of the pane.
 */
export function PositionTable() {
  const { side, report, stale, evals, busy, lock, unlock } = useRepertoireData();
  const { fen, epd, visible, yourTurn, point, locked, prev, prevEntry } = useHere();
  const playMove = useRepertoirePage((s) => s.playMove);
  const scroller = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [seenFen, setSeenFen] = useState(fen);

  // Reset transient state when the position changes (adjust-during-render pattern).
  if (seenFen !== fen) {
    setSeenFen(fen);
    setActive(0);
  }

  // A new position starts at the top of the list.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [fen]);

  const rows = useMemo<Row[]>(() => {
    if (!yourTurn) return [];
    const out: Row[] = [...(point?.moves ?? [])].sort((a, b) => b.games - a.games).map((m) => ({ san: m.san, usage: m }));
    if (locked && !out.some((r) => r.san === locked)) out.push({ san: locked, usage: null });
    return out;
  }, [yourTurn, point, locked]);

  const idx = Math.min(active, Math.max(rows.length - 1, 0));
  const pointEval = point ? evals.get(point.epd) : undefined;
  const loading = stale || !report;

  // Keep the keyboard-selected row visible below the sticky header.
  useEffect(() => {
    const box = scroller.current;
    if (!box || !focused) return;
    const el = box.querySelector<HTMLElement>(`#rep-move-row-${idx}`);
    if (!el) return;
    const top = el.offsetTop;
    if (top - HEAD_PX < box.scrollTop) box.scrollTop = top - HEAD_PX;
    else if (top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + el.offsetHeight - box.clientHeight;
  }, [idx, focused]);

  const requestLock = (entry: NewRepertoireEntry) => {
    const ev = evals.get(entry.epd)?.moves[entry.san];
    if (ev && (ev.verdict === "dubious" || ev.verdict === "bad")) {
      setPending({ entry, ev });
      return;
    }
    setPending(null);
    void lock(entry);
  };
  const pendingHere = pending && (pending.entry.epd === epd || pending.entry.epd === prev?.epd) ? pending : null;
  const lockHere = (san: string) => requestLock({ side, epd, fen: point?.fen ?? fen, san, line: visible });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget || !rows.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(idx + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(idx - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      playMove(rows[idx].san);
      setActive(0);
    }
  };

  const empty = !loading && rows.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scroller}
        data-testid="position-table-scroller"
        className="@container relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]"
      >
        <table
          role="grid"
          data-local-keys
          tabIndex={0}
          aria-label="Moves you played in this position. Use up and down arrows to select, Enter to play."
          aria-activedescendant={focused && rows.length ? `rep-move-row-${idx}` : undefined}
          aria-busy={loading}
          onKeyDown={onKeyDown}
          onFocus={(e) => {
            if (e.target === e.currentTarget) setFocused(true);
          }}
          onBlur={(e) => {
            if (e.target === e.currentTarget) setFocused(false);
          }}
          className="w-full shrink-0 table-fixed border-separate border-spacing-0 text-left text-sm outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring/60"
        >
          <thead className="sticky top-0 z-10">
            <tr className="label-caps h-7 bg-card text-[11px] text-pencil [&>th]:border-b [&>th]:border-rule-strong">
              <th scope="col" className={cn(COL.move, "font-medium")}>Move</th>
              <th scope="col" className={cn(COL.games, "font-medium")}>
                <span className="sr-only @xs:not-sr-only">Games</span>
                <span aria-hidden className="@xs:hidden">G</span>
              </th>
              <th scope="col" className={cn(COL.share, "font-medium")}>Share</th>
              <th scope="col" className={cn(C.bar, "font-medium whitespace-nowrap")}>
                <span className="hidden @[34rem]:inline">White / Draw / Black</span>
                <span className="@[34rem]:hidden">W / D / B</span>
              </th>
              <th scope="col" className={cn(COL.score, "font-medium")}>Score</th>
              <th scope="col" className={cn(C.eval, "font-medium")}>Eval</th>
              <th scope="col" className={C.lock}>
                <span className="sr-only">Lock</span>
              </th>
            </tr>
          </thead>
          {!loading && yourTurn && point?.switch && (
            <tbody>
              <tr className="h-7">
                <td colSpan={7} className="truncate border-b border-rule px-3 text-xs text-muted-foreground">
                  Switched from <span className="font-mono text-ink">{point.switch.from}</span> to <span className="font-mono text-ink">{point.switch.to}</span> on{" "}
                  {shortDate(point.switch.date)}
                </td>
              </tr>
            </tbody>
          )}
          <tbody className={cn("ledger-body transition-opacity duration-200", busy && "pointer-events-none opacity-50")}>
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="h-10">
                  <td className={COL.move}><Skeleton className="h-4 w-10" /></td>
                  <td className={COL.games}><Skeleton className="ml-auto h-4 w-8" /></td>
                  <td className={COL.share}><Skeleton className="ml-auto h-4 w-7" /></td>
                  <td className={C.bar}><Skeleton className="h-4 w-full" /></td>
                  <td className={COL.score}><Skeleton className="ml-auto h-4 w-8" /></td>
                  <td className={C.eval}><Skeleton className="ml-auto h-4 w-8" /></td>
                  <td className={C.lock} />
                </tr>
              ))}
            {!loading &&
              rows.map((r, i) => {
                const stats = r.usage ? usageStats(r.usage) : null;
                const isLocked = r.san === locked;
                const suggested = !locked && !!point && r.san === point.main;
                const delay = Math.min(i, 12) * 28;
                return (
                  <tr
                    key={`${epd}-${r.san}`}
                    id={`rep-move-row-${i}`}
                    onClick={() => {
                      playMove(r.san);
                      setActive(0);
                    }}
                    onMouseEnter={() => setActive(i)}
                    aria-selected={focused && i === idx}
                    style={{ animationDelay: `${delay}ms` }}
                    className={cn("row-in group/row relative isolate h-10 cursor-pointer [&>td]:border-b [&>td]:border-rule", focused && i === idx && "[&>td]:border-transparent")}
                  >
                    <td className={COL.move}>
                      <span aria-hidden className="row-wash" />
                      <PencilTick seed={r.san} className="row-tick absolute top-1/2 left-0 -translate-y-1/2" />
                      <div className="flex min-w-0 items-center gap-1.5 leading-tight text-ink motion-safe:transition-transform motion-safe:duration-150 motion-safe:group-hover/row:translate-x-0.5">
                        <span className="font-mono text-sm font-semibold">{r.san}</span>
                        {suggested && (
                          <RubberStamp size="sm" variant="single" tone="muted" rotate={1} seed={`s-${epd}`} className="min-w-0 truncate" title="Suggested">
                            Suggested
                          </RubberStamp>
                        )}
                      </div>
                    </td>
                    <td className={cn(COL.games, "text-sm")}>{compact(r.usage?.games ?? 0)}</td>
                    <td className={cn(COL.share, "text-xs text-muted-foreground")}>{shareLabel(r.usage?.games ?? 0, point?.games ?? 0)}</td>
                    <td className={C.bar}>
                      <WdbBar stats={stats} side={side} seed={r.san} delay={delay + 60} />
                    </td>
                    <td className={cn(COL.score, "text-sm")}>
                      <ScoreChip sc={stats ? score(stats) : 0} total={stats?.total ?? 0} />
                    </td>
                    <td className={C.eval}>
                      <VerdictChip ev={pointEval?.moves[r.san]} />
                    </td>
                    <td className={C.lock}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("size-8", isLocked ? "text-ink" : "text-muted-foreground")}
                        disabled={busy}
                        aria-label={isLocked ? `Unlock ${r.san}` : `Lock in ${r.san}`}
                        title={isLocked ? `Unlock ${r.san}` : `Lock in ${r.san}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isLocked) void unlock(epd, r.san);
                          else lockHere(r.san);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {isLocked ? <Lock /> : <LockOpen />}
                      </Button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {/* the space under a short table stays ruled like the ledger */}
        {!loading && !empty && <div aria-hidden className="ledger-void min-h-0 flex-1" />}

        {empty && (
          <div className="absolute inset-x-0 top-7 bottom-0 flex items-center justify-center overflow-hidden">
            {yourTurn ? (
              <EmptySpecimen
                className="py-2"
                title={`Fewer than ${MIN_GAMES} of your games reach this position.`}
                hint="Play your move on the board to add it to your repertoire."
              />
            ) : (
              <EmptySpecimen
                className="py-2"
                title="Opponent to move."
                hint="Play their reply on the board."
                action={
                  prev ? (
                    prevEntry?.san === prev.san ? (
                      <p className="text-sm">
                        Your move here: <span className="font-mono font-semibold text-ink">{prev.san}</span>
                      </p>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        {prevEntry && (
                          <p className="text-sm text-muted-foreground">
                            Your move here is <span className="font-mono text-ink">{prevEntry.san}</span>.
                          </p>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="max-sm:h-10"
                          disabled={busy}
                          onClick={() => requestLock({ side, epd: prev.epd, fen: prev.fen, san: prev.san, line: prev.line })}
                        >
                          Lock in {prev.san} here
                        </Button>
                      </div>
                    )
                  ) : undefined
                }
              />
            )}
          </div>
        )}
      </div>

      {pendingHere && (
        <div role="alert" className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-rule-strong px-3 py-1.5 text-sm">
          <p className="min-w-0 flex-1 basis-60">
            The engine rates <span className="font-mono font-semibold">{pendingHere.entry.san}</span> as {verdictPhrase(pendingHere.ev.verdict)} here
            {pendingHere.ev.lossCp != null && pendingHere.ev.lossCp > 0 ? ` (${lossLabel(pendingHere.ev.lossCp)})` : ""}. Lock it in anyway?
          </p>
          <span className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="max-sm:h-10"
              disabled={busy}
              onClick={() => {
                const e = pendingHere.entry;
                setPending(null);
                void lock(e);
              }}
            >
              Lock in anyway
            </Button>
            <Button variant="outline" size="sm" className="max-sm:h-10" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}
