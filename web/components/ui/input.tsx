import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Typed onto a ruled line: a faint pressed-in field with a printed rule along the bottom (the control boundary,
 * >= 3:1). Focus thickens the rule to primary ink and draws a crisp outline. Numeric inputs use mono figures.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const numeric = type === "number" || props.inputMode === "numeric" || props.inputMode === "decimal";
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-[2px] border border-rule-strong/35 border-b-[1.5px] border-b-foreground/70 bg-sheet-flat/60 px-3 py-1 text-base shadow-[inset_0_1px_2px_color-mix(in_oklab,var(--shadow-ink)_14%,transparent)] outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-b-primary focus-visible:shadow-[inset_0_-1px_0_0_var(--primary),inset_0_1px_2px_color-mix(in_oklab,var(--shadow-ink)_14%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 md:text-sm",
        numeric && "font-mono tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
