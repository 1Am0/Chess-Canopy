"use client";

import { useMemo } from "react";
import { deckledPath } from "@/lib/paper";
import { useElementSize } from "@/components/paper/use-size";
import { cn } from "@/lib/utils";

/**
 * A second sheet peeking out from under its parent: same size, shifted down-right a few
 * pixels, turned a fraction of a degree, in a slightly darker, yellower cream with a
 * deckled outline. Drawn at the wrapper's exact pixel size (clip-path from the seeded
 * generator), behind the sheet, and never part
 * of layout. Keep `rotate` within +-1deg and the offset inside the surrounding padding.
 *
 * Usage: a positioned wrapper holds the UnderSheet first and the sheet after it, so the sheet
 * paints over it (a stacking context paints its own background below negative-z children,
 * which is why the under-sheet cannot live inside the sheet itself):
 *   <div className="relative isolate"><UnderSheet /><PaperSheet className="relative">...</PaperSheet></div>
 */
export function UnderSheet({
  seed = 3,
  dx = 5,
  dy = 7,
  rotate = 0.7,
  className,
}: {
  seed?: number | string;
  dx?: number;
  dy?: number;
  rotate?: number;
  className?: string;
}) {
  const [ref, size] = useElementSize<HTMLSpanElement>();
  const clip = useMemo(() => (size ? deckledPath(seed, size.w, size.h, 1.5, 6) : null), [seed, size]);
  return (
    <span
      ref={ref}
      aria-hidden
      className={cn("paper-deco pointer-events-none absolute inset-0 block", className)}
      style={{ filter: "drop-shadow(0.5px 1px 0.8px color-mix(in oklab, var(--shadow-ink) 40%, transparent)) drop-shadow(2px 4px 5px color-mix(in oklab, var(--shadow-ink) 22%, transparent))" }}
    >
      {clip && (
        <span
          className="absolute inset-0 block"
          style={{
            transform: `translate(${dx}px, ${dy}px) rotate(${Math.max(-1, Math.min(1, rotate))}deg)`,
            transformOrigin: "0 0",
            backgroundColor: "var(--sheet-under)",
            backgroundImage: "var(--sheet-tile)",
            clipPath: `path("${clip}")`,
          }}
        />
      )}
    </span>
  );
}
