"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type { Color } from "@/lib/engine/types";
import type { CanopyTree } from "@/lib/canopy/types";
import { lineText } from "@/lib/canopy/labels";
import { lookupOpening } from "@/lib/openings/lookup";
import { pct, formatDate, resultLabel } from "@/lib/format";
import { useLeafGame } from "@/hooks/use-canopy-game";
import { nodeInfo } from "@/components/canopy/info";
import { WdbBar } from "@/components/explorer/WdbBar";
import { scoreTextClass } from "@/components/explorer/wdb";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RESULT_TEXT = { Win: "text-win-text", Draw: "text-draw-text", Loss: "text-loss-text" } as const;

/** What a node is: the line, the opening, the numbers and (for a single game) the game itself. */
export function NodeDetails({ tree, id, side, className }: { tree: CanopyTree; id: number; side: Color; className?: string }) {
  const n = nodeInfo(tree, id, side);
  const leaf = useLeafGame(tree, id);
  const opening = useMemo(() => {
    const rel = relSans(tree, id);
    const here = lookupOpening([...tree.path, ...rel])?.name ?? null;
    const root = lookupOpening(tree.path)?.name ?? null;
    return here && here !== root ? here : null;
  }, [tree, id]);

  return (
    <div className={cn("text-xs", className)}>
      <p className="font-mono text-xs leading-snug font-medium break-words">{lineText(tree, id, 8)}</p>
      {opening && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{opening}</p>}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
        {n.isLeaf ? (
          <>
            <dt className="text-muted-foreground">Result</dt>
            <dd className={cn("font-medium", n.leafResult === "win" ? RESULT_TEXT.Win : n.leafResult === "loss" ? RESULT_TEXT.Loss : RESULT_TEXT.Draw)}>
              {n.leafResult === "win" ? "Win" : n.leafResult === "loss" ? "Loss" : "Draw"}
            </dd>
          </>
        ) : (
          <>
            <dt className="text-muted-foreground">Games</dt>
            <dd className="font-medium">{n.games.toLocaleString()}</dd>
            <dt className="text-muted-foreground">Share</dt>
            <dd>{pct(n.share)} <span className="text-muted-foreground">of parent</span></dd>
            <dt className="text-muted-foreground">Score</dt>
            <dd className={cn("font-medium", scoreTextClass(n.score, n.games))}>{pct(n.score)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Depth</dt>
        <dd>move {n.moveNo}</dd>
      </dl>
      {!n.isLeaf && (
        <BarFor n={n} side={side} />
      )}
      {n.isLeaf && (
        <div className="mt-2 border-t pt-2">
          <p className="text-[11px] font-medium text-muted-foreground">Single game</p>
          {leaf.status === "loading" && <Skeleton className="mt-1 h-3.5 w-full" />}
          {leaf.status === "ready" && leaf.game && (
            <p className="mt-0.5 leading-snug break-words">
              vs {leaf.game.opponent}
              {leaf.game.opponent_rating != null && <span className="text-muted-foreground"> ({leaf.game.opponent_rating})</span>}
              <span className="text-muted-foreground"> · {formatDate(leaf.game.date)} · </span>
              <span className={RESULT_TEXT[resultLabel(leaf.game.result)]}>{resultLabel(leaf.game.result)}</span>
              <span className="text-muted-foreground"> · {Math.ceil(leaf.game.moves.length / 2)} moves</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BarFor({ n, side }: { n: ReturnType<typeof nodeInfo>; side: Color }) {
  // Player-perspective stats rebuilt from the chess-convention split.
  const wins = side === "white" ? n.wdb.white : n.wdb.black;
  const losses = side === "white" ? n.wdb.black : n.wdb.white;
  const total = n.wdb.total;
  const stats = { wins, losses, draws: n.wdb.draw, total, winRate: wins / (total || 1), drawRate: n.wdb.draw / (total || 1), lossRate: losses / (total || 1) };
  return <WdbBar stats={stats} side={side} labels={false} className="mt-2 h-1.5" />;
}

function relSans(t: CanopyTree, i: number): string[] {
  const out: string[] = [];
  for (let j = i; j > 0; j = t.parent[j]) if (t.san[j]) out.push(t.san[j]);
  return out.reverse();
}

export const TOOLTIP_W = 248;

/**
 * HTML tooltip for the hovered or focused node: 12 px right of and above the anchor, flipped
 * to stay inside the stage. Purely visual (aria-hidden): the tree navigator carries the names.
 */
export function CanopyTooltip({
  tree,
  id,
  side,
  anchor,
  bounds,
  hint,
}: {
  tree: CanopyTree;
  id: number;
  side: Color;
  anchor: { x: number; y: number };
  bounds: { w: number; h: number };
  /** "Click to play" etc. (fine pointers only) */
  hint: string | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const h = el.offsetHeight;
    const pad = 8;
    let x = anchor.x + 12;
    if (x + TOOLTIP_W > bounds.w - pad) x = anchor.x - 12 - TOOLTIP_W;
    x = Math.max(pad, Math.min(x, bounds.w - TOOLTIP_W - pad));
    let y = anchor.y - 12 - h;
    if (y < pad) y = anchor.y + 16;
    y = Math.max(pad, Math.min(y, bounds.h - h - pad));
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    el.style.opacity = "1";
  });
  return (
    <div
      ref={box}
      aria-hidden="true"
      data-testid="canopy-tooltip"
      style={{ width: TOOLTIP_W, opacity: 0 }}
      className="pointer-events-none absolute top-0 left-0 z-20 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md transition-opacity duration-100 motion-reduce:transition-none"
    >
      <NodeDetails tree={tree} id={id} side={side} />
      {hint && <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
