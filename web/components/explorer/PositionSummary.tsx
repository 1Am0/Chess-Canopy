"use client";

import { useExplorerStore } from "@/lib/store";
import { pct } from "@/lib/format";
import { WdlBar } from "@/components/explorer/WdlBar";
import { Skeleton } from "@/components/ui/skeleton";

export function PositionSummary() {
  const result = useExplorerStore((s) => s.result);
  const loading = useExplorerStore((s) => s.resultLoading);
  if (!result) return <Skeleton className="h-14 w-full" />;
  const { stats } = result;
  return (
    <section aria-label="Position summary" className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-semibold tabular-nums tracking-tight ${loading ? "opacity-50" : ""}`}>
            {stats.total.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">{stats.total === 1 ? "game" : "games"} here</span>
        </div>
        {stats.total > 0 && (
          <div className="flex gap-3 text-xs tabular-nums text-muted-foreground">
            <span><span className="mr-1 inline-block size-2 rounded-full bg-win" />{pct(stats.winRate)} win</span>
            <span><span className="mr-1 inline-block size-2 rounded-full bg-draw" />{pct(stats.drawRate)} draw</span>
            <span><span className="mr-1 inline-block size-2 rounded-full bg-loss" />{pct(stats.lossRate)} loss</span>
          </div>
        )}
      </div>
      {stats.total > 0 && <WdlBar stats={stats} className="h-6" />}
    </section>
  );
}
