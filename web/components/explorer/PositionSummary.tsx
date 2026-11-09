"use client";

import { useExplorerStore } from "@/lib/store";
import { pct, score } from "@/lib/format";
import { scoreTextClass, toWdb, wdbPercents } from "@/components/explorer/wdb";
import { WdbBar, WdbSwatch } from "@/components/explorer/WdbBar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const LEGEND = [
  { kind: "white", label: "White" },
  { kind: "draw", label: "Draw" },
  { kind: "black", label: "Black" },
] as const;

/**
 * Fixed 52px slot: "N games · score%" + legend on one line, the W/D/B bar below.
 * Never collapses: out of book it reads "0 games" over an empty striped bar.
 */
export function PositionSummary({ className }: { className?: string }) {
  const result = useExplorerStore((s) => s.result);
  const loading = useExplorerStore((s) => s.resultLoading);
  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const stats = result?.stats ?? null;
  const total = stats?.total ?? 0;
  const sc = stats ? score(stats) : 0;
  const p = stats && total ? wdbPercents(toWdb(stats, side)) : null;

  return (
    <section
      aria-label="Position summary"
      aria-busy={loading || !result}
      className={cn("flex h-[52px] shrink-0 flex-col justify-center gap-1.5", className)}
    >
      <div className={cn("flex h-5 items-center justify-between gap-3 whitespace-nowrap transition-opacity duration-200", loading && result && "opacity-50")}>
        {result ? (
          <p className="flex min-w-0 items-baseline gap-1.5 overflow-hidden">
            <span className="text-base font-semibold tracking-tight tabular-nums">{total.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">{total === 1 ? "game" : "games"}</span>
            <span aria-hidden className="text-muted-foreground">·</span>
            <span className={cn("text-sm font-semibold tabular-nums", scoreTextClass(sc, total))}>{total ? pct(sc) : "–"}</span>
            <span className="sr-only text-sm text-muted-foreground sm:not-sr-only">score</span>
          </p>
        ) : (
          <Skeleton className="h-4 w-40" />
        )}
        <p className="flex shrink-0 items-center gap-2.5 text-xs text-muted-foreground tabular-nums">
          {LEGEND.map((l) => (
            <span key={l.kind} className="inline-flex items-center gap-1">
              <WdbSwatch kind={l.kind} />
              <span className="hidden sm:inline">{l.label}</span>
              <span className="sr-only sm:hidden">{l.label}</span>
              <span className="min-w-[3ch] text-right text-foreground/80">{p ? `${Math.round(p[l.kind])}%` : "–"}</span>
            </span>
          ))}
        </p>
      </div>
      <WdbBar stats={stats} side={side} labels={false} className={cn("transition-opacity duration-200", loading && result && "opacity-50")} />
    </section>
  );
}
