"use client";
import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { keepNavKeysLocal } from "@/components/ui/keys";

const itemClass =
  "inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-t-sm border border-rule-strong bg-specimen px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,box-shadow] hover:bg-card hover:text-foreground focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:z-[1] data-[state=on]:border-b-card data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_2px_0_0_var(--primary)] [&:not(:first-child)]:-ml-px";

function ToggleGroup({ className, onKeyDown, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-local-keys
      className={cn("flex w-fit items-end", className)}
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
