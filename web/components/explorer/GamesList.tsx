"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { GameSummary } from "@/lib/engine/types";
import { getExplorer } from "@/lib/explorer-client";
import { activeFilterCount, useExplorerStore } from "@/lib/store";
import { usePosition } from "@/hooks/use-position";
import { formatDate, resultLabel, sourceLabel } from "@/lib/format";
import { EmptySpecimen } from "@/components/field";
import { HighlighterWash, RubberStamp } from "@/components/paper";
import { hashSeed } from "@/lib/paper";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Player-perspective stamps: this list is about *your* results, so win/loss inks apply. */
const RESULT_TONE = { Win: "win", Draw: "draw", Loss: "loss" } as const;

/** A stamp never lands twice at the same angle: a seeded tilt in [-1.8, 1.8] degrees. */
const tilt = (seed: string) => ((hashSeed(seed) % 7) - 3) * 0.6;

const LIMIT = 25;

/**
 * The Games tab: most recent games that reached the position. A scroll region with a
 * sticky header and fixed 32px rows. After the first load it never swaps to a
 * skeleton: the previous list stays, dimmed, until the new one lands.
 */
export function GamesList({ className, active = true }: { className?: string; active?: boolean }) {
  const { key, visible } = usePosition();
  const selectionVersion = useExplorerStore((s) => s.selectionVersion);
  const positionTotal = useExplorerStore((s) => s.result?.stats.total);
  const loadGame = useExplorerStore((s) => s.loadGame);
  const loadedGame = useExplorerStore((s) => s.loadedGame);
  const pathLine = useExplorerStore((s) => s.path.join(" "));
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [limit, setLimit] = useState(LIMIT);
  const lastKey = useRef("");
  const scroller = useRef<HTMLDivElement>(null);
  const fetched = useRef("");
  const summary = useExplorerStore((s) => s.summary);
  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const filterCount = useExplorerStore((s) => activeFilterCount(s.filters));
  const clearFilters = useExplorerStore((s) => s.clearFilters);
  const setSide = useExplorerStore((s) => s.setSide);

  // The panel is always mounted; only ask the worker while the tab is showing, and only
  // when the position / selection changed since the last fetch.
  useEffect(() => {
    if (!active || selectionVersion === 0) return;
    // A new position or selection starts again at one page; "Show more" only grows the limit.
    const base = `${key}|${selectionVersion}`;
    if (lastKey.current !== base) {
      lastKey.current = base;
      if (limit !== LIMIT) {
        setLimit(LIMIT);
        return;
      }
    }
    const stamp = `${base}|${attempt}|${limit}`;
    if (fetched.current === stamp) return;
    fetched.current = stamp;
    let stale = false;
    let finished = false;
    setLoading(true);
    getExplorer()
      .gamesAt(visible, limit)
      .then((g) => {
        finished = true;
        if (stale) return;
        setGames(g);
        setFailed(false);
        setLoading(false);
        if (scroller.current && limit === LIMIT) scroller.current.scrollTop = 0;
      })
      .catch(() => {
        finished = true;
        if (stale) return;
        fetched.current = ""; // allow a retry
        setFailed(true);
        setLoading(false);
      });
    return () => {
      stale = true;
      // A superseded fetch must not block the next one for the same stamp.
      if (!finished && fetched.current === stamp) fetched.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, selectionVersion, active, attempt, limit]);

  const other = side === "white" ? "black" : "white";
  const otherCount = summary?.counts[other] ?? 0;
  const noGames = !!summary && summary.games === 0;

  const count =
    games && games.length > 0
      ? positionTotal != null && positionTotal > games.length
        ? `${games.length} of ${positionTotal.toLocaleString()}`
        : String(games.length)
      : null;

  return (
    <div
      ref={scroller}
      aria-busy={active && (loading || games === null)}
      className={cn("relative h-full min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]", className)}
    >
      <h3 className="label-caps sticky top-0 z-10 flex h-7 items-center gap-1.5 border-b border-rule-strong bg-card px-3 text-[13px] text-pencil">
        <span className="text-ink">Recent games here</span>
        {count && <span className="tabular-nums">· {count}</span>}
      </h3>
      <ul aria-label="Recent games" className={cn("transition-opacity duration-200", loading && games !== null && !failed && "opacity-50")}>
        {games === null &&
          Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex h-8 items-center gap-2 px-3">
              <Skeleton className="h-5 w-11" />
              <Skeleton className="h-4 flex-1" />
            </li>
          ))}
        {failed && (
          <li role="alert">
            <EmptySpecimen
              title="Couldn't load the games"
              hint="Something went wrong while reading the saved games."
              action={
                <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                  <RotateCcw /> Retry
                </Button>
              }
            />
          </li>
        )}
        {!failed && games?.length === 0 && noGames && filterCount === 0 && otherCount > 0 && (
          <li>
            <EmptySpecimen
              title={`No games as ${side === "white" ? "White" : "Black"}`}
              hint="This selection only has games with the other color."
              action={
                <Button size="sm" variant="outline" onClick={() => setSide(other)}>
                  View as {other === "white" ? "White" : "Black"} ({otherCount.toLocaleString()} {otherCount === 1 ? "game" : "games"})
                </Button>
              }
            />
          </li>
        )}
        {!failed && games?.length === 0 && noGames && filterCount > 0 && (
          <li>
            <EmptySpecimen
              title="No games match these filters"
              hint="Loosen or clear the filters to see your games."
              action={<Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>}
            />
          </li>
        )}
        {!failed && games?.length === 0 && !(noGames && (filterCount > 0 || otherCount > 0)) && (
          <li>
            <EmptySpecimen title="No specimens collected here" hint="No games reach this position." />
          </li>
        )}
        {!failed && games?.map((g) => {
          const r = resultLabel(g.result);
          const gameKey = `${g.source}:${g.game_id}`;
          const loaded = loadedGame?.key === gameKey && loadedGame.line === pathLine;
          return (
            <li
              key={gameKey}
              className="relative isolate flex h-8 items-center border-b border-rule text-sm whitespace-nowrap"
            >
              {loaded && <HighlighterWash fill tone="green" seed={`loaded-${gameKey}`} />}
              <button
                type="button"
                onClick={() => {
                  loadGame(g.moves, gameKey);
                  toast.success("Game loaded", { id: "game-loaded", description: "Use → to step through the rest of it." });
                }}
                aria-pressed={loaded}
                title="Load this game into the line"
                className="flex h-full min-w-0 flex-1 items-center gap-2 pl-3 text-left outline-none transition-colors hover:bg-specimen/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                <span className="sr-only">Load game: {r} </span>
                <span aria-hidden className="flex w-9 shrink-0 justify-center">
                  <RubberStamp tone={RESULT_TONE[r]} variant="single" size="md" rotate={tilt(gameKey)} seed={gameKey} className="min-w-[1.5rem] justify-center text-center">
                    {r[0]}
                  </RubberStamp>
                </span>
                <span
                  className={cn("size-3 shrink-0 rounded-full ring-1 ring-foreground/40", g.color === "white" ? "bg-white" : "bg-neutral-900")}
                  title={`Played ${g.color}`}
                  aria-label={`Played ${g.color}`}
                  role="img"
                />
                <span className="min-w-0 flex-1 truncate font-sans font-medium text-ink underline decoration-ink/35 decoration-1 underline-offset-[3px]">
                  {g.opponent}
                  {g.opponent_rating != null && <span className="ml-1 text-muted-foreground tabular-nums">({g.opponent_rating})</span>}
                </span>
                <span className="label-caps hidden w-16 shrink-0 truncate text-right text-[13px] sm:block">{g.time_control}</span>
                <span className="hidden w-[6.5rem] shrink-0 text-right font-mono text-xs text-pencil tabular-nums sm:block">{formatDate(g.date)}</span>
                <span className="label-caps hidden w-16 shrink-0 text-right text-[13px] sm:block">
                  {g.source === "chess.com" || g.source === "lichess" ? sourceLabel(g.source) : ""}
                </span>
              </button>
              <span className="flex w-11 shrink-0 items-center justify-center">
                {g.url?.startsWith("http") && (
                  <a
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open game vs ${g.opponent} on ${sourceLabel(g.source)}`}
                    className="px-1 py-1.5 font-mono text-[11px] text-pencil underline decoration-ink/40 underline-offset-[3px] outline-none hover:text-ink hover:decoration-ink focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span aria-hidden>open</span>
                  </a>
                )}
              </span>
            </li>
          );
        })}
        {!failed && games && positionTotal != null && games.length >= limit && positionTotal > games.length && (
          <li className="flex h-9 items-center justify-center">
            <Button size="sm" variant="ghost" disabled={loading} onClick={() => setLimit((n) => n + LIMIT)}>
              Show {Math.min(LIMIT, positionTotal - games.length)} more
            </Button>
          </li>
        )}
      </ul>
    </div>
  );
}
