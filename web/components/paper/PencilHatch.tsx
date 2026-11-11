"use client";

import { useMemo } from "react";
import { pencilHatchSvg, svgDataUri } from "@/lib/paper";
import { cn } from "@/lib/utils";

/**
 * Pencil hatching as a fill: slanted graphite lines, each a little different in weight, tiled seamlessly. It is a CSS
 * mask (the tile) over a `--pencil` background, so the colour follows the theme and `color` can override it. Fills its
 * positioned parent unless you size it; use it for "no data" fills (an eval bar with no eval) and shading.
 *
 *   <div className="relative h-20 w-3"><PencilHatch gap={4} /></div>
 *
 * `dir` 1 slants "/" and -1 slants "\". Decorative: aria-hidden, hidden in forced-colors mode.
 */
export function PencilHatch({
  gap = 5,
  dir = 1,
  seed = 1,
  opacity = 0.55,
  color = "var(--pencil)",
  className,
  style,
}: {
  gap?: number;
  dir?: 1 | -1;
  seed?: number | string;
  opacity?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const tile = useMemo(() => {
    const { svg, size } = pencilHatchSvg(seed, gap, dir);
    return { url: `url("${svgDataUri(svg)}")`, size };
  }, [seed, gap, dir]);
  return (
    <span
      aria-hidden
      className={cn("paper-deco pointer-events-none absolute inset-0 block", className)}
      style={{
        backgroundColor: color,
        opacity,
        maskImage: tile.url,
        WebkitMaskImage: tile.url,
        maskSize: `${tile.size}px ${tile.size}px`,
        WebkitMaskSize: `${tile.size}px ${tile.size}px`,
        maskRepeat: "repeat",
        WebkitMaskRepeat: "repeat",
        ...style,
      }}
    />
  );
}
