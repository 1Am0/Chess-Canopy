"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { GameSummary } from "@/lib/engine/types";
import { getExplorer } from "@/lib/explorer-client";
import { useExplorerStore } from "@/lib/store";
import { usePosition } from "@/hooks/use-position";
import { formatDate, resultLabel, sourceLabel } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Player-perspective chips: this list is about *your* results, so win/loss colors apply. */
const RESULT_STYLE = {
  Win: "bg-win/15 text-win-text",
  Draw: "bg-draw/20 text-draw-text",
  Loss: "bg-loss/15 text-loss-text",
} as const;

const LIMIT = 25;

/**
 * The Games tab: most recent games that reached the position. A scroll region with a
 * sticky header and fixed 32px rows. After the first load it never swaps to a
 * skeleton: the previous list stays, dimmed, until the new one lands.
 */
export function GamesList({ className }: { className?: string }) {
  const { key, visible } = usePosition();
  const selectionVersion = useExplorerStore((s) => s.selectionVersion);
  const positionTotal = useExplorerStore((s) => s.result?.stats.total);
  const loadGame = useExplorerStore((s) => s.loadGame);
  const loadedGame = useExplorerStore((s) => s.loadedGame);
  const pathLine = useExplorerStore((s) => s.path.join(" "));
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectionVersion === 0) return;
    let stale = false;
    setLoading(true);
    const done = (g: GameSummary[]) => {
      if (stale) return;
      setGames(g);
      setLoading(false);
      if (scroller.current) scroller.current.scrollTop = 0;
    };
    getExplorer()
      .gamesAt(visible, LIMIT)
      .then(done)
      .catch(() => done([]));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, selectionVersion]);

  const count =
    games && games.length > 0
      ? positionTotal != null && positionTotal > games.length
        ? `${games.length} of ${positionTotal.toLocaleString()}`
        : String(games.length)
      : null;

  return (
    <div
      ref={scroller}
      aria-busy={loading || games === null}
      className={cn("h-full min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]", className)}
    >
      <h3 className="sticky top-0 z-10 flex h-7 items-center gap-1.5 border-b bg-muted px-3 text-xs font-medium text-muted-foreground">
        <span className="text-foreground">Recent games here</span>
        {count && <span className="tabular-nums">· {count}</span>}
      </h3>
      <ul aria-label="Recent games" className={cn("transition-opacity duration-200", loading && games !== null && "opacity-50")}>
        {games === null &&
          Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex h-8 items-center gap-2 px-3">
              <Skeleton className="h-5 w-11" />
              <Skeleton className="h-4 flex-1" />
            </li>
          ))}
        {games?.length === 0 && <li className="flex h-8 items-center px-3 text-sm text-muted-foreground">No games reach this position.</li>}
        {games?.map((g) => {
          const r = resultLabel(g.result);
          const gameKey = `${g.source}:${g.game_id}`;
          const loaded = loadedGame?.key === gameKey && loadedGame.line === pathLine;
          return (
            <li
              key={gameKey}
              className={cn("flex h-8 items-center whitespace-nowrap text-sm even:bg-muted/45", loaded && "bg-accent even:bg-accent")}
            >
              <button
                type="button"
                onClick={() => loadGame(g.moves, gameKey)}
                aria-label={`Load game vs ${g.opponent} into the line`}
                aria-pressed={loaded}
                title="Load this game into the line"
                className="flex h-full min-w-0 flex-1 items-center gap-2 pl-3 text-left outline-none transition-colors hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
              >
                <span className={cn("w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-medium", RESULT_STYLE[r])}>{r}</span>
                <span
                  className={cn("size-3 shrink-0 rounded-full ring-1 ring-foreground/40", g.color === "white" ? "bg-white" : "bg-neutral-900")}
                  title={`Played ${g.color}`}
                  aria-label={`Played ${g.color}`}
                  role="img"
                />
                <span className="min-w-0 flex-1 truncate">
                  {g.opponent}
                  {g.opponent_rating != null && <span className="ml-1 text-muted-foreground tabular-nums">({g.opponent_rating})</span>}
                </span>
                <span className="hidden w-16 shrink-0 truncate text-right text-xs text-muted-foreground capitalize sm:block">{g.time_control}</span>
                <span className="hidden w-[6.5rem] shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:block">{formatDate(g.date)}</span>
                <span className="hidden w-16 shrink-0 text-right text-[11px] text-muted-foreground sm:block">
                  {g.source === "chess.com" || g.source === "lichess" ? sourceLabel(g.source) : ""}
                </span>
              </button>
              <span className="flex w-9 shrink-0 items-center justify-center">
                {g.url?.startsWith("http") && (
                  <a
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open game vs ${g.opponent} on ${sourceLabel(g.source)}`}
                    className="rounded p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
