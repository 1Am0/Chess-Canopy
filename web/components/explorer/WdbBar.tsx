import type { Color, Stats } from "@/lib/engine/types";
import { segmentLabel, toWdb, wdbLabel, wdbPercents } from "@/components/explorer/wdb";
import { cn } from "@/lib/utils";

const SEGMENTS = [
  { key: "white", name: "White wins", cls: "bg-bar-white text-bar-white-fg [box-shadow:var(--bar-gloss-white)]" },
  { key: "draw", name: "Draws", cls: "bg-bar-draw text-bar-draw-fg [box-shadow:var(--bar-gloss)]" },
  { key: "black", name: "Black wins", cls: "bg-bar-black text-bar-black-fg [box-shadow:var(--bar-gloss)]" },
] as const;

/**
 * Stacked White | Draw | Black result bar (chess convention, independent of the viewed
 * side). Always renders the same three nodes, so a position change only animates widths.
 * With no games it shows a neutral striped bar of the same size.
 */
export function WdbBar({
  stats,
  side,
  labels = true,
  className,
}: {
  /** Player-perspective stats; null or total 0 renders the empty bar. */
  stats: Stats | null | undefined;
  side: Color;
  labels?: boolean;
  className?: string;
}) {
  const w = stats && stats.total > 0 ? toWdb(stats, side) : null;
  const p = w ? wdbPercents(w) : null;
  return (
    <div
      role="img"
      aria-label={w ? wdbLabel(w) : "No games"}
      className={cn(
        "relative flex h-4 w-full overflow-hidden rounded-[3px] text-[11px] leading-none font-medium tabular-nums",
        !w && "bar-empty",
        className,
      )}
    >
      {SEGMENTS.map((s) => {
        const n = w ? w[s.key] : 0;
        const pc = p ? p[s.key] : 0;
        return (
          <span
            key={s.key}
            title={w && n ? `${s.name}: ${n.toLocaleString()} (${Math.round(pc)}%)` : undefined}
            className={cn(
              "flex h-full min-w-0 items-center justify-center overflow-hidden whitespace-nowrap transition-[width] duration-300 ease-out motion-reduce:transition-none",
              s.cls,
            )}
            style={{ width: `${pc}%` }}
          >
            {labels ? segmentLabel(pc) : null}
          </span>
        );
      })}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_var(--bar-border)]" />
    </div>
  );
}

/** Tiny swatch matching a bar segment, for legends. */
export function WdbSwatch({ kind, className }: { kind: "white" | "draw" | "black"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-[2px] shadow-[inset_0_0_0_1px_var(--bar-border)]",
        kind === "white" ? "bg-bar-white" : kind === "draw" ? "bg-bar-draw" : "bg-bar-black",
        className,
      )}
    />
  );
}
