"use client";
import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { CardTape } from "@/components/ui/paper-chrome";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

/** An index card with an offset second card under it and a strip of tape across the top. Pass `tape={false}` to omit the tape. */
function PopoverContent({
  className,
  children,
  align = "center",
  sideOffset = 6,
  tape = true,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & { tape?: boolean }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn("paper-card relative z-50 w-72 p-4 text-popover-foreground outline-hidden data-[state=open]:paper-settle", className)}
        {...props}
      >
        {tape && <CardTape variant="sage" seed="popover" />}
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
