"use client";

import { useMemo } from "react";
import { useElementSize } from "@/components/paper/use-size";
import { ticketPath, type TicketEnds } from "@/lib/paper";
import { cn } from "@/lib/utils";

/**
 * A paper ticket / receipt strip: a cream strip whose left and right ends are cut, either as a perforated tear-off
 * stub (`ends="perforated"`: steady half-round notches) or ripped (`ends="torn"`: uneven teeth). The outline comes from
 * `ticketPath`, drawn at the strip's exact pixel size and applied as a clip-path to the paper; the paper shadow lives on
 * an outer wrapper so the cut does not slice it off. Children are laid out normally inside; give the strip its height with
 * `className` (it adds no padding of its own, so leave `px-3` or so for the notches).
 *
 *   <TicketEdge ends="perforated" className="h-11 px-4 flex items-center">1. e4 e5 2. Nf3</TicketEdge>
 *
 * Until measured (first paint) the strip is a plain rectangle. Forced-colors: a plain bordered box.
 */
export function TicketEdge({
  ends = "perforated",
  seed = 1,
  notch = 3.5,
  as: Comp = "div",
  className,
  wrapperClassName,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  ends?: TicketEnds;
  seed?: number | string;
  notch?: number;
  as?: "div" | "ol" | "ul" | "nav";
  /** Classes for the shadow wrapper (margins, width). */
  wrapperClassName?: string;
}) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const clip = useMemo(() => (size && size.w > 12 && size.h > 6 ? `path("${ticketPath(seed, size.w, size.h, { ends, notch: ends === "torn" ? notch * 1.5 : notch, pitch: 10 })}")` : undefined), [seed, size, ends, notch]);
  return (
    <div
      className={cn("relative", wrapperClassName)}
      style={{ filter: "drop-shadow(0.5px 1px 0.8px color-mix(in oklab, var(--shadow-ink) 42%, transparent)) drop-shadow(1.5px 3px 3px color-mix(in oklab, var(--shadow-ink) 20%, transparent))" }}
    >
      <Comp
        ref={ref as React.Ref<never>}
        className={cn("bg-[var(--btn-face)] [background-image:var(--sheet-tile)] forced-colors:border forced-colors:[background-image:none]", className)}
        style={clip ? { clipPath: clip } : undefined}
        {...(props as React.HTMLAttributes<HTMLElement>)}
      >
        {children}
      </Comp>
    </div>
  );
}
