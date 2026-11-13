"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { GameSummary } from "@/lib/engine/types";
import { classifyResult } from "@/lib/engine/trie";
import { getExplorer } from "@/lib/explorer-client";
import { compact } from "@/lib/format";
import { isResultFresh, useExplorerStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** How many games are listed per position (the newest first). */
const LIMIT = 60;

const CHIP: Record<"win" | "draw" | "loss", { label: string; bg: string }> = {
  win: { label: "Won", bg: "oklch(0.83 0.12 152)" },
  draw: { label: "Draw", bg: "oklch(0.91 0.035 92)" },
  loss: { label: "Lost", bg: "oklch(0.83 0.09 28)" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2024-03-07" -> "7 Mar 2024" (no Date parsing, so no time-zone shifts). */
function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso || "–";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/**
 * The games that reached the current position, in the same ledger rows as the moves above:
 * result chip, opponent (rating), time control, date. A row opens the game on its site when
 * it has a link. The header carries the position's game count.
 */
export function GamesList({ className }: { className?: string }) {
  const result = useExplorerStore((s) => s.result);
  const fresh = useExplorerStore(isResultFresh);
  const [games, setGames] = useState<{ key: string; list: GameSummary[] } | null>(null);
  const req = useRef(0);
  const total = result?.stats.total ?? 0;
  const key = result ? `${result.path.join(" ")}|${result.color}|${total}` : "";

  useEffect(() => {
    if (!result || !fresh) return;
    const id = ++req.current;
    getExplorer()
      .gamesAt(result.path, LIMIT)
      .then((list) => {
        if (id === req.current) setGames({ key, list });
      })
      .catch(() => {
        if (id === req.current) setGames({ key, list: [] });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fresh]);

  const list = games?.key === key ? games.list : null;

  return (
    <div className={cn("@container flex h-full min-h-0 flex-col", className)}>
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-rule-strong px-3">
        <h3 className="label-caps text-[11px] text-pencil">Games</h3>
        <span data-testid="position-games" className="font-mono text-xs text-ink tabular-nums">
          {result ? compact(total) : ""}
        </span>
        {list && total > list.length && (
          <span className="ml-auto text-xs text-muted-foreground">newest {list.length}</span>
        )}
      </div>
      <ul aria-label="Games at this position" className="ledger-body min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
        {list?.map((g, i) => {
          const kind = classifyResult(g.result ?? "*");
          const chip = kind ? CHIP[kind] : null;
          const opp = g.opponent || "Unknown";
          const rating = g.opponent_rating != null ? ` (${g.opponent_rating})` : "";
          const body = (
            <>
              <span className="w-12 shrink-0">
                {chip ? (
                  <span className="score-chip text-[12px]" style={{ backgroundColor: chip.bg }}>
                    {chip.label}
                  </span>
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                <span className="font-medium">{opp}</span>
                <span className="text-muted-foreground tabular-nums">{rating}</span>
              </span>
              <span className="hidden w-16 shrink-0 text-xs text-muted-foreground capitalize @xs:inline">{g.time_control || "–"}</span>
              <span className="w-[5.5rem] shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">{shortDate(g.date)}</span>
              <span className="w-4 shrink-0 text-muted-foreground">{g.url && <ExternalLink aria-hidden className="size-3.5" />}</span>
            </>
          );
          const row = "row-in group/row relative flex h-10 items-center gap-3 pr-3 pl-4";
          return (
            <li key={`${g.game_id}-${i}`} style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }} className="row-in">
              {g.url ? (
                <a
                  href={g.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open the game against ${opp}`}
                  className={cn(row, "outline-none hover:bg-specimen/60 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring")}
                >
                  {body}
                </a>
              ) : (
                <div className={row}>{body}</div>
              )}
            </li>
          );
        })}
        {list && list.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No games reach this position.</li>}
      </ul>
    </div>
  );
}
