"use client";

import { useExplorerStore } from "@/lib/store";
import { pct, score } from "@/lib/format";
import { scoreTextClass, toWdb, wdbPercents } from "@/components/explorer/wdb";
import { WdbBar, WdbSwatch } from "@/components/explorer/WdbBar";
import { Handnote } from "@/components/paper";
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
export function PositionSummary({ className, note }: { className?: string; note?: string | null }) {
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
      className={cn("relative flex h-[52px] shrink-0 flex-col justify-center gap-1.5", className)}
    >
      <div className={cn("flex h-5 items-center justify-between gap-3 whitespace-nowrap transition-opacity duration-200", loading && result && "opacity-50")}>
        {result ? (
          <p className="flex min-w-0 items-baseline gap-1.5 overflow-hidden">
            <span className="font-serif text-lg leading-none font-semibold tracking-tight text-ink tabular-nums">{total.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">{total === 1 ? "game" : "games"}</span>
            {total > 0 && (
              <>
                <span aria-hidden className="text-muted-foreground">·</span>
                <span className={cn("font-serif text-base font-semibold tabular-nums", scoreTextClass(sc, total))}>{pct(sc)}</span>
                <span className="sr-only text-sm text-muted-foreground sm:not-sr-only">score</span>
              </>
            )}
          </p>
        ) : (
          <Skeleton className="h-4 w-40" />
        )}
        <p aria-hidden={!p} className={cn("label-caps flex shrink-0 items-center gap-2.5 text-[13px] tabular-nums", !p && "invisible")}>
          {LEGEND.map((l) => (
            <span key={l.kind} className="inline-flex items-center gap-1">
              <WdbSwatch kind={l.kind} />
              <span className="hidden sm:inline">{l.label}</span>
              <span className="sr-only sm:hidden">{l.label}</span>
              <span className="min-w-[3ch] text-right text-ink/80">{p ? `${Math.round(p[l.kind])}%` : "–"}</span>
            </span>
          ))}
        </p>
      </div>
      {note && (
        // A pencil note in the free middle of the first row (absolute, so the 52px slot is untouched).
        // Only on wide sheets: narrower ones carry the same note on the tape across the top.
        <Handnote seed="best" rotate={-1.2} className="absolute top-[3px] left-[35%] hidden @[38rem]/sheet:inline-block">
          {note}
        </Handnote>
      )}
      <WdbBar stats={stats} side={side} labels={false} className={cn("transition-opacity duration-200", loading && result && "opacity-50")} />
    </section>
  );
}
