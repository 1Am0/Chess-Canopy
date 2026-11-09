"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { GameSummary } from "@/lib/engine/types";
import { getExplorer } from "@/lib/explorer-client";
import { useExplorerStore } from "@/lib/store";
import { usePosition } from "@/hooks/use-position";
import { formatDate, resultLabel, sourceLabel } from "@/lib/format";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RESULT_STYLE = {
  Win: "bg-win/15 text-win",
  Draw: "bg-draw/20 text-muted-foreground",
  Loss: "bg-loss/15 text-loss",
} as const;

export function GamesList() {
  const { key, visible } = usePosition();
  const selectionVersion = useExplorerStore((s) => s.selectionVersion);
  const [open, setOpen] = useState(true);
  const [games, setGames] = useState<GameSummary[] | null>(null);

  useEffect(() => {
    if (!open || selectionVersion === 0) return;
    let stale = false;
    setGames(null);
    getExplorer()
      .gamesAt(visible, 10)
      .then((g) => {
        if (!stale) setGames(g);
      })
      .catch(() => {
        if (!stale) setGames([]);
      });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key, selectionVersion]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <span>
          Recent games here
          {games && games.length > 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">{games.length}</span>}
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y border-t">
          {games === null && (
            <li className="space-y-2 p-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </li>
          )}
          {games?.length === 0 && <li className="p-3 text-sm text-muted-foreground">No games reach this position.</li>}
          {games?.map((g) => {
            const r = resultLabel(g.result);
            return (
              <li key={`${g.source}:${g.game_id}`} className="flex items-center gap-2 px-3 py-1 text-sm">
                <span className={cn("w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-medium", RESULT_STYLE[r])}>{r}</span>
                <span
                  className={cn("size-3 shrink-0 rounded-full border", g.color === "white" ? "bg-white" : "bg-neutral-800")}
                  title={`Played ${g.color}`}
                  aria-label={`Played ${g.color}`}
                />
                <span className="min-w-0 flex-1 truncate">
                  {g.opponent}
                  {g.opponent_rating != null && <span className="ml-1 text-muted-foreground tabular-nums">({g.opponent_rating})</span>}
                </span>
                <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">{formatDate(g.date)}</span>
                {(g.source === "chess.com" || g.source === "lichess") && (
                  <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">{sourceLabel(g.source)}</Badge>
                )}
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
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
