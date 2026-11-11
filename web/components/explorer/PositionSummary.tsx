"use client";

import { useExplorerStore } from "@/lib/store";
import { pct, score } from "@/lib/format";
import { scoreTextClass } from "@/components/explorer/wdb";
import { WdbBar } from "@/components/explorer/WdbBar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Fixed 52px slot: "N games · score%" on one line, then the W/D/B bar with its strips labelled directly, the W/D/B bar below.
 * Never collapses: out of book it reads "0 games" over an empty striped bar.
 */
export function PositionSummary({ className, note }: { className?: string; note?: string | null }) {
  const result = useExplorerStore((s) => s.result);
  const loading = useExplorerStore((s) => s.resultLoading);
  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const stats = result?.stats ?? null;
  const total = stats?.total ?? 0;
  const sc = stats ? score(stats) : 0;

  return (
    <section
      aria-label="Position summary"
      aria-busy={loading || !result}
      className={cn("relative flex h-[52px] shrink-0 flex-col justify-between", className)}
    >
      <div className={cn("flex h-5 items-center gap-3 whitespace-nowrap transition-opacity duration-200", loading && result && "opacity-50")}>
        {result ? (
          <p className="flex min-w-0 items-baseline gap-1.5 overflow-hidden">
            <span className="text-lg leading-none font-semibold tracking-tight text-strong tabular-nums">{total.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">{total === 1 ? "game" : "games"}</span>
            {total > 0 && (
              <>
                <span aria-hidden className="text-muted-foreground">·</span>
                <span className={cn("text-base font-semibold tabular-nums", scoreTextClass(sc, total))}>{pct(sc)}</span>
                <span className="sr-only text-sm text-muted-foreground sm:not-sr-only">score</span>
              </>
            )}
          </p>
        ) : (
          <Skeleton className="h-4 w-40" />
        )}
        {note && <span className="ml-auto min-w-0 truncate text-sm text-muted-foreground">{note}</span>}
      </div>
      <WdbBar stats={stats} side={side} named className={cn("h-6 transition-opacity duration-200", loading && result && "opacity-50")} />
    </section>
  );
}
