import type { Color, Stats } from "@/lib/engine/types";
import { barLabel, toWdb, wdbLabel, wdbPercents } from "@/components/explorer/wdb";
import { cn } from "@/lib/utils";

const SEGMENTS = [
  { key: "white", name: "White wins", label: "White", fill: "wdb-white", chip: "wdb-chip-white" },
  { key: "draw", name: "Draws", label: "Draw", fill: "wdb-draw", chip: "wdb-chip-draw" },
  { key: "black", name: "Black wins", label: "Black", fill: "wdb-black", chip: "wdb-chip-black" },
] as const;

/** Summary-bar label: "White 40%" when the strip is wide, "40%" when narrow, nothing when a sliver. */
function namedLabel(name: string, p: number): string | null {
  if (p < 15) return null;
  const n = Math.round(p);
  return p >= 30 ? `${name} ${n}%` : `${n}%`;
}

/**
 * Stacked White | Draw | Black result bar (chess convention, independent of the viewed side), printed like a
 * letterpress plate: halftone dots for White, hatching for Draw, a soft black with a fine cross-hatch for Black,
 * one clean outline. Labels sit on solid chips and are left out under 15% (the hover
 * title still has the numbers). The segments draw in from the left (transform only, short stagger) whenever the
 * bar is mounted; callers re-key it when the position changes. With no games it shows a hatched blank strip.
 */
export function WdbBar({
  stats,
  side,
  labels = true,
  named = false,
  delay = 0,
  className,
}: {
  /** Player-perspective stats; null or total 0 renders the empty bar. */
  stats: Stats | null | undefined;
  side: Color;
  labels?: boolean;
  /** Label each strip with its name ("White 40%") where it is wide enough, digits where it is not (summary bar). */
  named?: boolean;
  /** No longer used (bars used to get a seeded off-register outline); kept so callers need not change. */
  seed?: string;
  /** Extra delay (ms) before the draw-in starts. */
  delay?: number;
  className?: string;
}) {
  const w = stats && stats.total > 0 ? toWdb(stats, side) : null;
  const p = w ? wdbPercents(w) : null;
  return (
    <div
      role="img"
      aria-label={w ? wdbLabel(w) : "No games"}
      className={cn("wdb h-[18px] w-full text-[11px] leading-none font-medium tabular-nums", !w && "wdb-empty", className)}
      style={delay ? ({ "--wdb-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {w && (
        <>
          <div className="wdb-track">
            {SEGMENTS.map((s, i) => {
              const n = w[s.key];
              const pc = p ? p[s.key] : 0;
              if (!n) return null; // an empty segment would still draw its dividing line
              const text = named ? namedLabel(s.label, pc) : labels ? barLabel(pc) : null;
              return (
                <span
                  key={s.key}
                  title={n ? `${s.name}: ${n.toLocaleString()} (${Math.round(pc)}%)` : undefined}
                  className={cn("wdb-seg font-mono whitespace-nowrap", s.fill)}
                  style={{ width: `${pc}%`, "--wdb-i": i } as React.CSSProperties}
                >
                  {text && <span className={cn("wdb-chip", s.chip)}>{text}</span>}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
