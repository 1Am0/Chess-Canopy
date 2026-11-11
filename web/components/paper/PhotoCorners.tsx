"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The four folded paper photo corners that hold a print on its mount. Put it inside a `relative`
 * wrapper around the print: each pocket's right angle sits on the print's corner (poking `inset` px past
 * it onto the mat). Each corner is two layers of paper: a darker back layer and a lighter folded front
 * layer whose edge carries a bright crease and a thin shadow cast onto the print, plus its own
 * small contact shadow. Corners are about 28px so they read as objects, not wedges.
 */
export function PhotoCorners({ size = 29, inset = 3, className }: { size?: number; inset?: number; className?: string }) {
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
          viewBox="0 0 30 30"
          className="absolute block overflow-visible"
          style={{ ...c.pos, transform: c.flip || undefined, filter: "drop-shadow(0.6px 1.1px 0.9px oklch(0 0 0 / 0.5))" }}
        >
          <defs>
            <linearGradient id={`${uid}-f${i}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="13" y2="13">
              <stop offset="0" stopColor="oklch(1 0 0)" stopOpacity="0.03" />
              <stop offset="1" stopColor="oklch(1 0 0)" stopOpacity="0.24" />
            </linearGradient>
            <linearGradient id={`${uid}-s${i}`} gradientUnits="userSpaceOnUse" x1="15" y1="15" x2="18.2" y2="18.2">
              <stop offset="0" stopColor="oklch(0 0 0)" stopOpacity="0.4" />
              <stop offset="1" stopColor="oklch(0 0 0)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* shadow the fold casts on the print */}
          <path d="M30 0L34 0L0 34L0 30Z" fill={`url(#${uid}-s${i})`} />
          {/* back layer (darker) */}
          <path d="M0 0L30 0L0 30Z" style={{ fill: "var(--photo-corner)" }} />
          <path d="M0 0L30 0L0 30Z" fill="oklch(0 0 0 / 0.22)" />
          {/* folded front layer (lighter), with a bright crease and a dark line under it */}
          <path d="M0 0L25.5 0L0 25.5Z" style={{ fill: "var(--photo-corner)" }} />
          <path d="M0 0L25.5 0L0 25.5Z" fill={`url(#${uid}-f${i})`} />
          <path d="M25.5 0L0 25.5" stroke="oklch(1 0 0 / 0.6)" strokeWidth="0.8" fill="none" />
          <path d="M23.4 0L0 23.4" stroke="oklch(0 0 0 / 0.28)" strokeWidth="0.6" fill="none" />
          {/* paper edges along the legs catch a little light */}
          <path d="M0.4 25L0.4 0.4L25 0.4" stroke="oklch(1 0 0 / 0.2)" strokeWidth="0.6" fill="none" />
        </svg>
      ))}
    </span>
  );
}
