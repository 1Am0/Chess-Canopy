"use client";
import * as React from "react";
import { Separator as SeparatorPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  variant = "single",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root> & { variant?: "single" | "double" }) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      data-variant={variant}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-rule data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px data-[variant=double]:bg-transparent data-[variant=double]:data-[orientation=horizontal]:h-[3px] data-[variant=double]:data-[orientation=horizontal]:border-y data-[variant=double]:data-[orientation=horizontal]:border-rule-strong data-[variant=double]:data-[orientation=vertical]:w-[3px] data-[variant=double]:data-[orientation=vertical]:border-x data-[variant=double]:data-[orientation=vertical]:border-rule-strong",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
