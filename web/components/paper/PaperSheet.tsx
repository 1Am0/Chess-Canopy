import { cn } from "@/lib/utils";

/**
 * A cut sheet of cream paper: paper tone, fibre tile, two-part paper shadow (tight contact +
 * soft lift), square corners. It adds no padding, border or margin of its own, so wrapping
 * an existing element never changes the measured geometry of what is inside; pass padding
 * in `className` where a margin around the content is wanted.
 *
 * It is `relative isolate`: absolutely positioned decorations (Tape, PhotoCorners, TornEdge) can be
 * dropped inside. (An UnderSheet goes beside it, in a shared wrapper: see UnderSheet.) Inside it,
 * `--card` / `--background` / `--specimen` resolve to the paper tones (see `paper-scope`). The tile is layered over a
 * low-frequency fibre tile (`--fibre`).
 */
export function PaperSheet({
  as: Tag = "div",
  curl = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  as?: "div" | "section" | "aside" | "header";
  /** Lifted-corner shadow under one end of the lower edge (static). Needs room below the sheet and no clipping parent. */
  curl?: boolean | "left" | "right";
}) {
  return (
    <Tag
      className={cn(
        "paper-scope sheet-paper relative isolate",
        curl && "sheet-curl",
        className,
      )}
      data-curl={curl === "left" ? "left" : undefined}
      {...(props as React.ComponentProps<"div">)}
    />
  );
}
