import { useId } from "react";
import { inkArrowPath, inkStrokePath, type InkArrowOptions } from "@/lib/paper";
import { cn } from "@/lib/utils";

const INKS = {
  ink: "var(--ink)",
  pencil: "var(--pencil)",
  green: "var(--primary)",
  red: "var(--loss-text)",
} as const;

/**
 * A tapered ink stroke (optionally with a nib arrowhead) from one point to another, drawn as a FILLED outline from
 * `inkStrokePath` / `inkArrowPath`. Coordinates are px relative to the top-left of the nearest positioned parent;
 * the svg is 1x1 with overflow visible, so it never changes layout.
 *
 *   <div className="relative"> <InkStroke from={[8, 40]} to={[120, 12]} seed="e2e4" width={5} arrow /> </div>
 *
 * For SVG-native overlays (the board), call `inkArrowPath(seed, x1, y1, x2, y2, { width })` directly and fill the
 * path yourself: that is all this component does. Decorative: aria-hidden, hidden in forced-colors mode.
 */
export function InkStroke({
  from,
  to,
  seed = 1,
  arrow = false,
  tone = "ink",
  opacity = 0.9,
  blend = true,
  draw = false,
  className,
  ...opts
}: {
  from: readonly [number, number];
  to: readonly [number, number];
  seed?: number | string;
  arrow?: boolean;
  tone?: keyof typeof INKS;
  opacity?: number;
  /** Multiply with the page, like ink soaking in (light mode). */
  blend?: boolean;
  /** Draw the stroke on once when it mounts (a mask line reveals it from `from` to `to`). Off under reduced motion. */
  draw?: boolean;
  className?: string;
} & InkArrowOptions) {
  const d = arrow
    ? inkArrowPath(seed, from[0], from[1], to[0], to[1], opts)
    : inkStrokePath(seed, from[0], from[1], to[0], to[1], opts);
  const uid = useId().replace(/:/g, "");
  const width = opts.width ?? 4;
  return (
    <svg
      aria-hidden
      width="1"
      height="1"
      className={cn(
        "paper-deco pointer-events-none absolute top-0 left-0 block overflow-visible",
        className,
      )}
      style={
        blend
          ? {
              mixBlendMode:
                "var(--hilite-blend)" as React.CSSProperties["mixBlendMode"],
            }
          : undefined
      }
    >
      {draw ? (
        <>
          <mask
            id={`${uid}-m`}
            maskUnits="userSpaceOnUse"
            x="-4000"
            y="-4000"
            width="8000"
            height="8000"
          >
            <path
              d={`M${from[0]} ${from[1]}L${to[0]} ${to[1]}`}
              pathLength={1}
              fill="none"
              stroke="#fff"
              strokeWidth={width * 4 + 24}
              className="ink-reveal"
            />
          </mask>
          <path
            d={d}
            mask={`url(#${uid}-m)`}
            style={{ fill: INKS[tone], opacity }}
          />
        </>
      ) : (
        <path d={d} style={{ fill: INKS[tone], opacity }} />
      )}
    </svg>
  );
}
