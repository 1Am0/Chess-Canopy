import { cn } from "@/lib/utils";

/**
 * A paper envelope seen from the front, for drop zones: a manila body, the flap's V-fold across the top and the
 * pocket's V-shaped top edge along the bottom. Children (the label, the file name) sit in the middle, clear of the
 * folds. `open` lifts the flap (use it while a file is dragged over). Folds are drawn with non-scaling strokes on a
 * stretched SVG, so it fits any size; it adds no layout of its own.
 *
 *   <Envelope open={dragging} className="min-h-28 p-4"> Drop a PGN here </Envelope>
 *
 * Decorative parts are aria-hidden; forced-colors mode falls back to a dashed border.
 */
export function Envelope({
  open = false,
  as: Comp = "div",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { open?: boolean; as?: "div" | "label" | "section" }) {
  return (
    <Comp
      data-open={open || undefined}
      className={cn(
        "relative isolate flex flex-col items-center justify-center overflow-hidden text-center [background-image:var(--sheet-tile)] bg-envelope forced-colors:border forced-colors:border-dashed forced-colors:[background-image:none]",
        className,
      )}
      style={{ boxShadow: "0 0 0 1px color-mix(in oklab, var(--envelope-edge) 85%, transparent), 0.5px 1px 1px var(--btn-drop), 2px 3px 5px -2px var(--btn-drop)" }}
      {...(props as React.HTMLAttributes<HTMLElement>)}
    >
      <svg aria-hidden className="paper-deco pointer-events-none absolute inset-0 -z-10 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
        {/* pocket: the front sheet's two diagonal folds from the bottom corners, with its lighter fill */}
        <path d="M0 100L0 52L50 74L100 52L100 100Z" style={{ fill: "oklch(1 0 0 / 0.16)" }} />
        <path d="M0 100L0 52L50 74L100 52L100 100" vectorEffect="non-scaling-stroke" strokeWidth="1" style={{ stroke: "var(--envelope-edge)", opacity: 0.55 }} />
        {/* flap: closed it points down to the middle, open it lies back up */}
        <path
          d={open ? "M0 0L50 16L100 0Z" : "M0 0L50 38L100 0Z"}
          vectorEffect="non-scaling-stroke"
          strokeWidth="1"
          strokeLinejoin="round"
          style={{ fill: "oklch(0 0 0 / 0.045)", stroke: "var(--envelope-edge)", opacity: 0.8 }}
        />
      </svg>
      <div className="relative z-0">{children}</div>
    </Comp>
  );
}
