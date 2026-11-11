"use client";
import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function ScrollArea({ className, children, ...props }: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn("relative", className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="size-full rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      orientation={orientation}
      className={cn(
        "flex touch-none bg-rule/40 p-[2px] transition-colors select-none",
        orientation === "vertical" && "h-full w-2.5 border-l border-l-rule",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-rule",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-[1px] border border-btn-edge/60 bg-btn-face shadow-[0.5px_1px_1px_var(--btn-drop)]" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
