"use client";
import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const itemClass =
  "inline-flex h-9 min-w-9 items-center justify-center gap-2 border px-3 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] first:rounded-l-md last:rounded-r-md hover:bg-muted hover:text-muted-foreground focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&:not(:first-child)]:-ml-px";

function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return <ToggleGroupPrimitive.Root className={cn("flex w-fit items-center rounded-md", className)} {...props} />;
}
function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return <ToggleGroupPrimitive.Item className={cn(itemClass, className)} {...props} />;
}

export { ToggleGroup, ToggleGroupItem };
