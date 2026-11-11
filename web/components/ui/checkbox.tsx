"use client";
import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { InkDash, InkTick } from "@/components/field/InkTick";
import { cn } from "@/lib/utils";

/*
 * A printed box with an ink check: 16px square, 1.5px ink edge, a faint second impression offset down-right (like a
 * slightly misregistered print). The check is a seeded pen stroke that draws itself on (off under reduced motion).
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const seed = React.useId();
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group/cb peer size-4 shrink-0 rounded-[1px] border-[1.5px] border-foreground bg-sheet-flat text-ink shadow-[1px_1px_0_0_color-mix(in_oklab,var(--foreground)_24%,transparent)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <InkTick seed={seed} draw className="size-[15px] group-data-[state=indeterminate]/cb:hidden" />
        <InkDash draw className="hidden size-[15px] group-data-[state=indeterminate]/cb:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
