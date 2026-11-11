"use client";
import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { keepNavKeysLocal } from "@/components/ui/keys";

/* A segmented control: joined 1px-bordered buttons, the selected one filled with the accent. */
const itemClass =
  "relative inline-flex h-9 min-w-9 items-center justify-center gap-2 border border-input bg-card px-3 text-sm font-medium whitespace-nowrap text-foreground transition-colors first:rounded-l-md last:rounded-r-md hover:bg-accent focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[-3px] focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:z-[1] data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&:not(:first-child)]:-ml-px";

function ToggleGroup({ className, onKeyDown, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-local-keys
      className={cn("flex w-fit items-stretch", className)}
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
