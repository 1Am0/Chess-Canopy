"use client";

import { useMemo } from "react";
import { useElementSize } from "@/components/paper/use-size";
import { washPath } from "@/lib/paper";
import { cn } from "@/lib/utils";

const TONES = {
  yellow: "var(--hilite)",
  green: "var(--hilite-green)",
  pink: "var(--hilite-pink)",
  blue: "var(--hilite-blue)",
} as const;

/**
 * A translucent marker wash behind its content, like a highlighter pen: the top and bottom edges drift and both
 * ends are uneven chisel cuts (seeded, so identical on every render). It multiplies with what is under it in light
 * mode (text stays dark, paper tints) and is a plain low-alpha overlay in dark mode (token `--hilite-blend`).
 *
 * Two uses:
 *   <HighlighterWash seed="nf3">Nf3</HighlighterWash>     inline: wraps text, washes exactly that span
 *   <HighlighterWash fill />                              fills its parent: put it in a row or cell that is `relative isolate`
 * The wash is decorative (aria-hidden, no pointer events, hidden in forced-colors mode): if the highlight means
 * something (the active row), also set aria-current / aria-selected on the element itself.
 * Until the first measurement it shows as a plain rectangle, so nothing flashes.
 */
export function HighlighterWash({
  children,
  tone = "yellow",
  seed = 1,
  fill = false,
  amp = 1.6,
  className,
}: {
  children?: React.ReactNode;
  tone?: keyof typeof TONES;
  seed?: number | string;
  /** Absolutely fill the parent instead of wrapping content. */
  fill?: boolean;
  /** How far the top and bottom edges may drift, in px. */
  amp?: number;
  className?: string;
}) {
  const [ref, size] = useElementSize<HTMLSpanElement>();
  const d = useMemo(() => (size && size.w > 2 && size.h > 2 ? washPath(seed, size.w, size.h, amp) : null), [seed, size, amp]);
  const svg = (
    <svg
      aria-hidden
      className="paper-deco pointer-events-none absolute inset-0 -z-10 block size-full overflow-visible"
      viewBox={size ? `0 0 ${size.w} ${size.h}` : "0 0 100 100"}
      preserveAspectRatio="none"
    >
      <path d={d ?? "M0 0H100V100H0Z"} style={{ fill: TONES[tone] }} />
    </svg>
  );
  if (fill) {
    return (
      <span ref={ref} aria-hidden className={cn("paper-deco pointer-events-none absolute inset-0 -z-10 block", className)}>
        {svg}
      </span>
    );
  }
  return (
    <span ref={ref} className={cn("relative isolate inline-block align-baseline", className)}>
      {children}
      {svg}
    </span>
  );
}
