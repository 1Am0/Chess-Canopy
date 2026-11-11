import { cn } from "@/lib/utils";

/**
 * A small typed label pasted on: cream card with fibre, a hairline edge and a tiny contact shadow, mono 11px.
 * Optional `taped` adds a bit of tape across its top-left corner; `tone` picks the stock; `rotate` (clamped to +-1.5deg)
 * sits it a hair off square. Real text inside; the paper bits are CSS only.
 *
 *   <PaperLabel>Opponents</PaperLabel>
 *   <PaperLabel tone="manila" taped rotate={-1}>You</PaperLabel>
 *
 * Use for player names on the mat, filter chips, short captions. Keep it to one line.
 */
export function PaperLabel({
  tone = "cream",
  taped = false,
  rotate = 0,
  as: Comp = "span",
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  tone?: "cream" | "manila" | "sage";
  taped?: boolean;
  rotate?: number;
  as?: "span" | "div" | "p" | "li";
}) {
  const r = Math.max(-1.5, Math.min(1.5, rotate));
  return (
    <Comp
      data-tone={tone}
      data-taped={taped || undefined}
      className={cn("paper-label inline-flex w-fit shrink-0 items-center gap-1 px-1.5 font-mono text-[11px] leading-5 tracking-wide whitespace-nowrap text-foreground", className)}
      style={r ? { transform: `rotate(${r}deg)`, ...style } : style}
      {...(props as React.HTMLAttributes<HTMLElement>)}
    />
  );
}
