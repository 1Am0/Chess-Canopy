"use client";

import { useExplorerStore } from "@/lib/store";
import { pct, score } from "@/lib/format";
import { scoreClass } from "@/lib/explorer-format";
import { WdlBar } from "@/components/explorer/WdlBar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PositionSummary({ className }: { className?: string }) {
  const result = useExplorerStore((s) => s.result);
  const loading = useExplorerStore((s) => s.resultLoading);
  if (!result) return <Skeleton className="h-12 w-full" />;
  const { stats } = result;
  const sc = score(stats);
  return (
    <section aria-label="Position summary" className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <div className={cn("flex items-baseline gap-1.5", loading && "opacity-50")}>
          <span className="text-xl font-semibold tabular-nums tracking-tight">{stats.total.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground">{stats.total === 1 ? "game" : "games"}</span>
          {stats.total > 0 && (
            <>
              <span className="text-muted-foreground" aria-hidden>·</span>
              <span className={cn("text-sm font-semibold tabular-nums", scoreClass(sc))}>{pct(sc)}</span>
              <span className="text-sm text-muted-foreground">score</span>
            </>
          )}
        </div>
        {stats.total > 0 && (
          <div className="flex gap-2.5 text-xs tabular-nums text-muted-foreground">
            <span><span className="mr-1 inline-block size-2 rounded-full bg-win" />{pct(stats.winRate)} win</span>
            <span><span className="mr-1 inline-block size-2 rounded-full bg-draw" />{pct(stats.drawRate)} draw</span>
            <span><span className="mr-1 inline-block size-2 rounded-full bg-loss" />{pct(stats.lossRate)} loss</span>
          </div>
        )}
      </div>
      {stats.total > 0 && <WdlBar stats={stats} className="h-4" showLabels={false} />}
    </section>
  );
}
