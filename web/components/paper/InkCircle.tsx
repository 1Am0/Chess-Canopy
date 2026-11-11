"use client";

import { useMemo } from "react";
import { useElementSize } from "@/components/paper/use-size";
import { inkEllipsePath } from "@/lib/paper";
import { cn } from "@/lib/utils";

const INKS = {
  ink: "var(--ink)",
  pencil: "var(--pencil)",
  green: "var(--primary)",
  red: "var(--loss-text)",
} as const;

/**
 * A hand-drawn ellipse round its content, as if someone circled it with a pen: about a turn and a bit, the radius
 * drifting outward and overshooting its own start (seeded, deterministic). The ring is drawn outside the content box
 * (`padX` / `padY` px of room) without changing layout: it is absolutely positioned over the wrapper.
 *
 *   <InkCircle seed="move-3">Nf3</InkCircle>
 *
 * Decorative: aria-hidden, no pointer events, hidden in forced-colors mode. If the circle marks a state (the current
 * move) also set aria-current on the element that carries it. Nothing is drawn until the wrapper is measured.
 */
export function InkCircle({
  children,
  seed = 1,
  tone = "ink",
  strokeWidth = 1.5,
  padX = 6,
  padY = 3,
  draw = false,
  className,
}: {
  children: React.ReactNode;
  seed?: number | string;
  tone?: keyof typeof INKS;
  strokeWidth?: number;
  padX?: number;
  padY?: number;
  /** Animate the pen drawing the ring on first paint (off under reduced motion). */
  draw?: boolean;
  className?: string;
}) {
  const [ref, size] = useElementSize<HTMLSpanElement>();
  const geo = useMemo(() => {
    if (!size) return null;
    const w = size.w + padX * 2;
    const h = size.h + padY * 2;
    return { w, h, d: inkEllipsePath(seed, w, h, { pad: Math.min(3, strokeWidth * 1.5) }) };
  }, [size, seed, padX, padY, strokeWidth]);
  return (
    <span ref={ref} className={cn("relative inline-block", className)}>
      {children}
      {geo && (
        <svg
          aria-hidden
          width={geo.w}
          height={geo.h}
          viewBox={`0 0 ${geo.w} ${geo.h}`}
          className="paper-deco pointer-events-none absolute block overflow-visible"
          style={{ left: -padX, top: -padY }}
        >
          <path
            d={geo.d}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className={draw ? "ink-draw" : undefined}
            style={{ stroke: INKS[tone], opacity: tone === "pencil" ? 0.8 : 0.9 }}
          />
        </svg>
      )}
    </span>
  );
}
