"use client";

import { X } from "lucide-react";
import type { Color } from "@/lib/engine/types";
import type { CanopyTree } from "@/lib/canopy/types";
import { lineText } from "@/lib/canopy/labels";
import { formatDate, pct, resultLabel } from "@/lib/format";
import { useLeafGame } from "@/hooks/use-canopy-game";
import { nodeInfo } from "@/components/canopy/info";
import { WdbBar } from "@/components/explorer/WdbBar";
import { scoreTextClass } from "@/components/explorer/wdb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Touch has no hover: the first tap selects a node and this card shows what it is; Play (or a
 * second tap on the same node) plays it. A single game offers Load game instead.
 */
export function CanopySelectionCard({
  tree,
  id,
  side,
  onPlay,
  onClear,
}: {
  tree: CanopyTree;
  id: number;
  side: Color;
  onPlay: () => void;
  onClear: () => void;
}) {
  const n = nodeInfo(tree, id, side);
  const leaf = useLeafGame(tree, id);
  const wins = side === "white" ? n.wdb.white : n.wdb.black;
  const losses = side === "white" ? n.wdb.black : n.wdb.white;
  const stats = { wins, losses, draws: n.wdb.draw, total: n.games, winRate: 0, drawRate: 0, lossRate: 0 };
  const g = leaf.status === "ready" ? leaf.game : null;
  return (
    <div
      data-testid="canopy-selection"
      role="group"
      aria-label="Selected line"
      className="absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 flex min-h-28 flex-col gap-2 rounded-lg border bg-card p-3 shadow-md"
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 font-mono text-[13px] leading-snug font-medium break-words">{lineText(tree, id, 6)}</p>
        <button type="button" onClick={onClear} aria-label="Clear selection" className="-mt-1 -mr-1.5 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60">
          <X className="size-4" />
        </button>
      </div>
      {n.isLeaf ? (
        <p className="text-xs text-muted-foreground">
          {g ? (
            <>
              vs {g.opponent}
              {g.opponent_rating != null && ` (${g.opponent_rating})`} · {formatDate(g.date)} ·{" "}
              <span className={cn("font-medium", g.result && scoreTextClass(resultLabel(g.result) === "Win" ? 1 : resultLabel(g.result) === "Loss" ? 0 : 0.5, 1))}>{resultLabel(g.result)}</span>
            </>
          ) : (
            <>Single game · {n.leafResult}</>
          )}
        </p>
      ) : (
        <>
          <p className="text-xs tabular-nums">
            <span className="font-semibold">{n.games.toLocaleString()}</span> <span className="text-muted-foreground">games · {pct(n.share)} of parent ·</span>{" "}
            <span className={cn("font-semibold", scoreTextClass(n.score, n.games))}>{pct(n.score)}</span> <span className="text-muted-foreground">score</span>
          </p>
          <WdbBar stats={stats} side={side} labels={false} className="h-1.5" />
        </>
      )}
      <Button type="button" size="sm" onClick={onPlay} className="mt-auto h-10 w-full">
        {n.isLeaf ? "Load game" : "Play"}
      </Button>
    </div>
  );
}
