"use client";
import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { keepNavKeysLocal } from "@/components/ui/keys";

/*
 * Folder tabs: each trigger is a paper tab with chamfered top corners (the `folder-tab` utility). The active one is the
 * same paper as the panel under it, joined with no line between; inactive ones are a shade darker.
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn("flex flex-col gap-2", className)} {...props} />;
}
function TabsList({ className, onKeyDown, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-local-keys
      onKeyDown={(e) => {
        onKeyDown?.(e);
        keepNavKeysLocal(e);
      }}
      className={cn("inline-flex h-9 w-fit items-end justify-center gap-0.5 border-b border-rule-strong bg-transparent p-0 text-muted-foreground", className)}
      {...props}
    />
  );
}
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "folder-tab inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-none px-3 py-1 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_3px_0_0_var(--primary)] [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("flex-1 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
