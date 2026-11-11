"use client";
import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { keepNavKeysLocal } from "@/components/ui/keys";

const itemClass =
  "inline-flex h-9 min-w-9 items-center justify-center gap-2 border border-rule-strong px-3 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] first:rounded-l-md last:rounded-r-md hover:bg-muted hover:text-muted-foreground focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:z-[1] [&:not(:first-child)]:-ml-px";

function ToggleGroup({ className, onKeyDown, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-local-keys
      className={cn("flex w-fit items-center rounded-md", className)}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        keepNavKeysLocal(e);
      }}
      {...props}
    />
  );
}
function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return <ToggleGroupPrimitive.Item className={cn(itemClass, className)} {...props} />;
}

export { ToggleGroup, ToggleGroupItem };
