import { Tape } from "@/components/paper/Tape";

/**
 * A small strip of tape across the top edge of a floating card (menu, popover, dialog). Absolutely positioned inside
 * the card (which must be `relative` and must not clip its overflow). Decorative.
 */
export function CardTape({
  variant = "ochre",
  length = 56,
  height = 16,
  angle = -2,
  seed = "card-tape",
  align = "center",
}: {
  variant?: "ochre" | "sage";
  length?: number;
  height?: number;
  angle?: number;
  seed?: number | string;
  align?: "center" | "left" | "right";
}) {
  return (
    <span
      aria-hidden
      className={`paper-deco pointer-events-none absolute inset-x-0 z-10 flex ${align === "center" ? "justify-center" : align === "left" ? "justify-start pl-5" : "justify-end pr-5"}`}
      style={{ top: -height * 0.55 }}
    >
      <Tape variant={variant} length={length} height={height} angle={angle} seed={seed} className="relative" />
    </span>
  );
}
