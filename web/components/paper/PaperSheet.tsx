import { cn } from "@/lib/utils";

/**
 * A cut sheet of cream paper: paper tone, fibre tile, two-part paper shadow (tight contact +
 * soft lift), square corners. It adds no padding, border or margin of its own, so wrapping
 * an existing element never changes the measured geometry of what is inside; pass padding
 * in `className` where a margin around the content is wanted.
 *
 * It is `relative isolate`: absolutely positioned decorations (Tape, PhotoCorners, TornEdge) can be
 * dropped inside. (An UnderSheet goes beside it, in a shared wrapper: see UnderSheet.) Inside it,
 * `--card` / `--background` / `--specimen` resolve to the paper tones (see `paper-scope`).
 */
export function PaperSheet({
  as: Tag = "div",
  className,
  ...props
}: React.ComponentProps<"div"> & { as?: "div" | "section" | "aside" | "header" }) {
  return <Tag className={cn("paper-scope sheet-paper relative isolate", className)} {...(props as React.ComponentProps<"div">)} />;
}
