"use client";
import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { keepNavKeysLocal } from "@/components/ui/keys";

/*
 * Index tabs: a row of paper tabs on a shared printed baseline. The active tab is raised card stock joined to the
 * baseline with a primary ink flag along its top; inactive tabs are a shade darker and sit slightly behind. Never pills.
 * The baseline is drawn by the group (an absolutely positioned hairline), so the group's height is just the tabs.
 */
const itemClass =
  "relative inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-t-[3px] border border-rule-strong bg-specimen px-3 text-sm font-medium whitespace-nowrap text-muted-foreground [background-image:var(--sheet-tile)] shadow-[inset_0_-2px_3px_-2px_color-mix(in_oklab,var(--shadow-ink)_22%,transparent)] transition-[color,box-shadow] hover:bg-card hover:text-foreground focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:z-[1] data-[state=on]:border-b-card data-[state=on]:bg-card data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_2px_0_0_var(--primary),0_-1px_2px_-1px_color-mix(in_oklab,var(--shadow-ink)_30%,transparent)] [&:not(:first-child)]:-ml-px";

function ToggleGroup({ className, onKeyDown, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-local-keys
      className={cn("relative flex w-fit items-end after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-0 after:h-px after:bg-rule-strong", className)}
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
