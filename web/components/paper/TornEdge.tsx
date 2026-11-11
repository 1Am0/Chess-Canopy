"use client";

import { useMemo } from "react";
import { svgDataUri, tornStripPath } from "@/lib/paper";
import { cn } from "@/lib/utils";

const TILE_W = 520;

function mask(d: string, h: number): React.CSSProperties {
  const url = `url("${svgDataUri(`<svg xmlns='http://www.w3.org/2000/svg' width='${TILE_W}' height='${h}' viewBox='0 0 ${TILE_W} ${h}'><path d='${d}'/></svg>`)}")`;
  return {
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskRepeat: "repeat-x",
    maskRepeat: "repeat-x",
    WebkitMaskSize: `${TILE_W}px ${h}px`,
    maskSize: `${TILE_W}px ${h}px`,
    WebkitMaskPosition: "0 0",
    maskPosition: "0 0",
  };
}

/**
 * A torn paper edge hanging from the bottom of a strip (the header). Three layers, all clipped
 * by the same kind of seeded, seamlessly tiling tear: a darker under-strip peeking out lower,
 * a lighter rim where the paper fibres show, and the paper itself a pixel or two higher.
 * Colours come from tokens, so it follows the theme. Absolutely positioned at `top: 100%` of
 * a positioned parent; it adds nothing to layout.
 */
export function TornEdge({ seed = 11, height = 13, amp = 8, className }: { seed?: number | string; height?: number; amp?: number; className?: string }) {
  const layers = useMemo(() => {
    const underH = height + 4;
    return {
      underH,
      under: mask(tornStripPath(`${seed}-under`, TILE_W, underH, amp + 1, { loop: true, step: 4 }), underH),
      rim: mask(tornStripPath(seed, TILE_W, height, amp, { loop: true }), height),
      body: mask(tornStripPath(seed, TILE_W, height, amp, { loop: true, lift: 1.8 }), height),
    };
  }, [seed, height, amp]);

  return (
    <span
      aria-hidden
      className={cn("paper-deco pointer-events-none absolute inset-x-0 top-[calc(100%-1px)] block", className)}
      style={{
        height,
        // the shadow is for the torn edge only: cut it off above the 1px overlap with the strip
        clipPath: "inset(1px -24px -40px -24px)",
        filter:
          "drop-shadow(0 1px 0.8px color-mix(in oklab, var(--shadow-ink) 40%, transparent)) drop-shadow(1px 4px 6px color-mix(in oklab, var(--shadow-ink) 24%, transparent))",
      }}
    >
      <span className="absolute inset-x-0 top-0 block" style={{ height: layers.underH, backgroundColor: "var(--sheet-under)", ...layers.under }} />
      <span className="absolute inset-x-0 top-0 block" style={{ height, backgroundColor: "var(--sheet-rim)", ...layers.rim }} />
      <span className="absolute inset-x-0 top-0 block" style={{ height, backgroundColor: "var(--sheet)", backgroundImage: "var(--sheet-tile)", ...layers.body }} />
    </span>
  );
}
