"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The four folded paper photo corners that hold a print on its mount. Put it inside a
 * `relative` wrapper around the print: each corner is a right-angle pocket whose right angle sits
 * on the print's corner (and pokes `inset` px past it onto the mat). Each pocket has a
 * darker body, a lighter folded flap along the hypotenuse, a fold line and a tiny highlight.
 */
export function PhotoCorners({ size = 25, inset = 3, className }: { size?: number; inset?: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const corners = [
    { pos: { top: -inset, left: -inset }, flip: "" },
    { pos: { top: -inset, right: -inset }, flip: "scaleX(-1)" },
    { pos: { bottom: -inset, left: -inset }, flip: "scaleY(-1)" },
    { pos: { bottom: -inset, right: -inset }, flip: "scale(-1,-1)" },
  ];
  return (
    <span aria-hidden className={cn("paper-deco pointer-events-none absolute inset-0 z-10 block", className)}>
      {corners.map((c, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className="absolute block overflow-visible"
          style={{ ...c.pos, transform: c.flip || undefined, filter: "drop-shadow(0.5px 0.9px 0.7px oklch(0 0 0 / 0.42))" }}
        >
          <defs>
            <linearGradient id={`${uid}-g${i}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="13" y2="13">
              <stop offset="0" stopColor="oklch(0 0 0)" stopOpacity="0.28" />
              <stop offset="1" stopColor="oklch(1 0 0)" stopOpacity="0.06" />
            </linearGradient>
          </defs>
          <path d="M0 0L24 0L0 24Z" style={{ fill: "var(--photo-corner)" }} />
          <path d="M0 0L24 0L0 24Z" fill={`url(#${uid}-g${i})`} />
          {/* folded flap along the hypotenuse */}
          <path d="M24 0L19.2 0L0 19.2L0 24Z" fill="oklch(1 0 0 / 0.15)" />
          <path d="M19.2 0L0 19.2" stroke="oklch(0 0 0 / 0.3)" strokeWidth="0.6" fill="none" />
          <path d="M24 0L0 24" stroke="oklch(1 0 0 / 0.4)" strokeWidth="0.7" fill="none" />
        </svg>
      ))}
    </span>
  );
}
