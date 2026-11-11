import type { Color, Stats } from "@/lib/engine/types";
import { segmentLabel, toWdb, wdbLabel, wdbPercents } from "@/components/explorer/wdb";
import { cn } from "@/lib/utils";

const SEGMENTS = [
  { key: "white", name: "White wins", label: "White", cls: "bg-bar-white text-bar-white-fg" },
  { key: "draw", name: "Draws", label: "Draw", cls: "bg-bar-draw text-bar-draw-fg" },
  { key: "black", name: "Black wins", label: "Black", cls: "bg-bar-black text-bar-black-fg" },
] as const;

/** Summary-bar label: "White 40%" when the strip is wide, "40%" when narrow, nothing when a sliver. */
function namedLabel(name: string, p: number): string | null {
  if (p < 7) return null;
  const n = Math.round(p);
  return p >= 27 ? `${name} ${n}%` : `${n}%`;
}

/**
 * Stacked White | Draw | Black result bar (chess convention, independent of the viewed side), drawn as three strips
 * of flat color (white, gray, near-black) inside a 1px outline. Always renders the same three nodes, so a position
 * change only animates widths. With no games it shows a striped blank strip of the same size.
 */
export function WdbBar({
  stats,
  side,
  labels = true,
  named = false,
  className,
}: {
  /** Player-perspective stats; null or total 0 renders the empty bar. */
  stats: Stats | null | undefined;
  side: Color;
  labels?: boolean;
  /** Label each strip with its name ("White 40%") where it is wide enough, digits where it is not (summary bar). */
  named?: boolean;
  className?: string;
}) {
  const w = stats && stats.total > 0 ? toWdb(stats, side) : null;
  const p = w ? wdbPercents(w) : null;
  return (
    <div
      role="img"
      aria-label={w ? wdbLabel(w) : "No games"}
      className={cn(
        "relative flex h-4 w-full text-xs leading-none font-medium tabular-nums",
        w ? "border border-bar-border" : "bar-empty border border-dashed border-rule-strong",
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
              "flex h-full min-w-0 items-center justify-center overflow-hidden tabular-nums font-medium whitespace-nowrap transition-[width] duration-300 ease-out motion-reduce:transition-none forced-colors:border forced-colors:border-[CanvasText]",
              s.cls,
            )}
            style={{ width: `${pc}%` }}
          >
            {named ? namedLabel(s.label, pc) : labels ? (pc < 17 ? null : segmentLabel(pc)) : null}
          </span>
        );
      })}
    </div>
  );
}
