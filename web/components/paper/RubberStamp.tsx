import { hashSeed } from "@/lib/paper";
import { cn } from "@/lib/utils";

const TONES = {
  primary: "[--stamp:var(--primary)]",
  muted: "[--stamp:var(--muted-foreground)]",
  destructive: "[--stamp:var(--loss-text)]",
  win: "[--stamp:var(--win-text)]",
  draw: "[--stamp:var(--draw-text)]",
  loss: "[--stamp:var(--loss-text)]",
} as const;

/**
 * An inked rubber stamp: mono caps in a double border with a small tilt, the ink knocked out by seeded specks so it
 * never prints perfectly evenly (the speck and blotch tiles are shifted per seed, so two stamps do not match). Text is real text.
 *
 *   <RubberStamp tone="win" seed="g1">W</RubberStamp>
 *   <RubberStamp variant="single" rotate={1.2}>Imported 3 Nov</RubberStamp>
 *
 * `rotate` is clamped to +-2deg (the only tilt rule in the UI). `variant`: "double" (default, 3px double border) or
 * "single" (one 2px border, for small result stamps). `size`: "md" (11px) or "sm" (10px, ~18px tall).
 */
export function RubberStamp({
  tone = "primary",
  variant = "double",
  size = "md",
  rotate = -1.5,
  seed = 1,
  thunk = false,
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  tone?: keyof typeof TONES;
  variant?: "double" | "single";
  size?: "sm" | "md";
  rotate?: number;
  seed?: number | string;
  /** Land with a short thunk animation on mount (scale and opacity, once; off under reduced motion). */
  thunk?: boolean;
}) {
  const h = hashSeed(seed);
  const ox = h % 160;
  const oy = (h >>> 8) % 64;
  return (
    <span
      className={cn(
        "stamp",
        thunk && "stamp-thunk",
        TONES[tone],
        variant === "single" && "border-2 border-solid",
        size === "sm" && "px-1 py-0 text-[10px] leading-[1.4] tracking-[0.1em]",
        className,
      )}
      style={{
        transform: `rotate(${Math.max(-2, Math.min(2, rotate))}deg)`,
        maskPosition: `${ox}px ${oy}px`,
        WebkitMaskPosition: `${ox}px ${oy}px`,
        ...style,
      }}
      {...props}
    />
  );
}
