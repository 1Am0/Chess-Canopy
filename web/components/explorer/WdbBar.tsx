import { useMemo } from "react";
import type { Color, Stats } from "@/lib/engine/types";
import { segmentLabel, toWdb, wdbLabel, wdbPercents } from "@/components/explorer/wdb";
import { createRng, n2 } from "@/lib/paper";
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
 * The cut of each strip: a left and a right edge with four slightly different x offsets (0 to 2.2px), so the
 * strips look hand-cut with scissors and a hair of the sheet shows between neighbours. Seeded, so identical
 * on every render. Offsets only ever move inward: an empty (0%) strip clips to nothing.
 */
function cutPolygon(seed: string, key: string): string {
  const rng = createRng(`${seed}-${key}`);
  const ys = [0, 34, 68, 100];
  const left = ys.map((y) => `${n2(rng.range(0, 2.2))}px ${y}%`);
  const right = ys.map((y) => `calc(100% - ${n2(rng.range(0, 2.2))}px) ${y}%`).reverse();
  return `polygon(${[...left, ...right].join(",")})`;
}

/**
 * Stacked White | Draw | Black result bar (chess convention, independent of the viewed side), drawn as three strips
 * of cut paper laid side by side: cream paper, a graphite card and an ink card, each with a slightly irregular cut
 * end and a paper fibre. Always renders the same three nodes, so a position change only animates widths.
 * With no games it shows a pencil-hatched blank strip of the same size.
 */
export function WdbBar({
  stats,
  side,
  labels = true,
  named = false,
  seed = "wdb",
  className,
}: {
  /** Player-perspective stats; null or total 0 renders the empty bar. */
  stats: Stats | null | undefined;
  side: Color;
  labels?: boolean;
  /** Label each strip with its name ("White 40%") where it is wide enough, digits where it is not (summary bar). */
  named?: boolean;
  /** Varies the cut ends between bars (the move table passes the move). */
  seed?: string;
  className?: string;
}) {
  const w = stats && stats.total > 0 ? toWdb(stats, side) : null;
  const p = w ? wdbPercents(w) : null;
  const cuts = useMemo(() => SEGMENTS.map((s) => cutPolygon(seed, s.key)), [seed]);
  return (
    <div
      role="img"
      aria-label={w ? wdbLabel(w) : "No games"}
      className={cn(
        "relative flex h-4 w-full text-[11px] leading-none font-medium tabular-nums",
        !w && "bar-empty border border-dashed border-rule-strong",
        className,
      )}
      style={w ? { filter: "drop-shadow(0.6px 0 0 var(--bar-border)) drop-shadow(-0.6px 0 0 var(--bar-border)) drop-shadow(0 0.6px 0 var(--bar-border)) drop-shadow(0 -0.6px 0 var(--bar-border)) drop-shadow(0.4px 0.9px 0.7px color-mix(in oklab, var(--shadow-ink) 30%, transparent))" } : undefined}
    >
      {SEGMENTS.map((s, i) => {
        const n = w ? w[s.key] : 0;
        const pc = p ? p[s.key] : 0;
        return (
          <span
            key={s.key}
            title={w && n ? `${s.name}: ${n.toLocaleString()} (${Math.round(pc)}%)` : undefined}
            className={cn(
              "flex h-full min-w-0 items-center justify-center overflow-hidden font-mono whitespace-nowrap transition-[width] duration-300 ease-out [background-image:var(--sheet-tile)] motion-reduce:transition-none forced-colors:border forced-colors:border-[CanvasText]",
              s.cls,
            )}
            style={{ width: `${pc}%`, clipPath: cuts[i] }}
          >
            {named ? namedLabel(s.label, pc) : labels ? segmentLabel(pc) : null}
          </span>
        );
      })}
    </div>
  );
}
