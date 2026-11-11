import { handArrow, wobbleLine } from "@/lib/paper";
import { cn } from "@/lib/utils";

/**
 * A short pencil annotation in the margin: Caveat in --pencil, never data on its own.
 * Optional extras drawn by the seeded generator:
 *   - `arrow`: a hand-drawn arrow from (x1, y1) to (x2, y2) in px, relative to the note's
 *     top-left corner (it may leave the box; the note is `relative` and overflow stays visible)
 *   - `underline`: a slightly wobbly pencil underline.
 * Decorative: aria-hidden and pointer-events-none. Put it where it does not change any measured slot
 * (position it `absolute` inside an existing box).
 */
export function Handnote({
  children,
  arrow,
  underline = true,
  seed = 1,
  rotate = -1,
  className,
  style,
}: {
  children: React.ReactNode;
  arrow?: { x1: number; y1: number; x2: number; y2: number; bow?: number };
  underline?: boolean;
  seed?: number | string;
  rotate?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={cn("paper-deco pointer-events-none relative inline-block font-hand text-[18px] leading-5 font-medium whitespace-nowrap text-pencil", className)}
      style={{ transform: `rotate(${Math.max(-2, Math.min(2, rotate))}deg)`, ...style }}
    >
      {children}
      {underline && (
        <svg className="absolute inset-x-0 -bottom-[2px] block h-[5px] w-full" viewBox="0 0 160 5" preserveAspectRatio="none">
          <path d={wobbleLine(`u-${seed}`, 1, 3, 159, 2.2, 0.9)} fill="none" strokeWidth="1.1" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ stroke: "var(--pencil)", opacity: 0.75 }} />
        </svg>
      )}
      {arrow && (
        <svg className="absolute top-0 left-0 block overflow-visible" width="1" height="1" fill="none">
          <path
            d={handArrow(`a-${seed}`, arrow.x1, arrow.y1, arrow.x2, arrow.y2, arrow.bow ?? 4)}
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: "var(--pencil)" }}
          />
        </svg>
      )}
    </span>
  );
}
