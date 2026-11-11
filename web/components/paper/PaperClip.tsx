import { cn } from "@/lib/utils";

/**
 * A steel paper clip (a gem clip: two nested loops), 11 x 28 at size 1. Drawn as two strokes, a dark base and a thin
 * glint, so it reads as wire. Slider thumbs use it; also good for holding a label to a sheet. `angle` is clamped to +-12deg.
 * Decorative: aria-hidden. Scale it with `size` (a multiplier on the 11 x 28 box).
 */
export function PaperClip({ size = 1, angle = 0, className, style }: { size?: number; angle?: number; className?: string; style?: React.CSSProperties }) {
  const d = "M4 21V7.5a2.5 2.5 0 0 1 5 0V23a4 4 0 0 1-8 0V4a4.5 4.5 0 0 1 9 0V19";
  return (
    <svg
      aria-hidden
      width={11 * size}
      height={28 * size}
      viewBox="0 0 11 28"
      fill="none"
      className={cn("paper-deco pointer-events-none block overflow-visible", className)}
      style={{ transform: angle ? `rotate(${Math.max(-12, Math.min(12, angle))}deg)` : undefined, filter: "drop-shadow(0.6px 1px 0.7px color-mix(in oklab, var(--shadow-ink) 55%, transparent))", ...style }}
    >
      <path d={d} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--clip-steel)" }} />
      <path d={d} strokeWidth="0.45" strokeLinecap="round" strokeLinejoin="round" transform="translate(-0.35 -0.2)" style={{ stroke: "var(--clip-glint)" }} />
    </svg>
  );
}
