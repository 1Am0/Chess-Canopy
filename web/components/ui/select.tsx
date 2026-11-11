"use client";
import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { InkTick } from "@/components/field/InkTick";
import { CardTape } from "@/components/ui/paper-chrome";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-9 w-fit items-center justify-between gap-2 rounded-[2px] border border-rule-strong/35 border-b-[1.5px] border-b-foreground/70 bg-sheet-flat/60 px-3 py-2 text-sm whitespace-nowrap shadow-[inset_0_1px_2px_color-mix(in_oklab,var(--shadow-ink)_14%,transparent)] outline-none focus-visible:border-b-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          "paper-card relative z-50 min-w-[8rem] text-popover-foreground data-[state=open]:paper-settle",
          position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        <CardTape variant="sage" seed="select" />
        <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
          <ChevronUpIcon className="size-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport
          className={cn("max-h-[calc(var(--radix-select-content-available-height)-1rem)] p-1", position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]")}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
          <ChevronDownIcon className="size-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label className={cn("kicker mb-0 px-2 pt-2 pb-1", className)} {...props} />;
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  const seed = React.useId();
  return (
    <SelectPrimitive.Item
      className={cn(
        "paper-row relative flex min-h-8 w-full cursor-default items-center gap-2 rounded-none py-1 pr-8 pl-2 text-sm outline-hidden select-none focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <InkTick seed={seed} draw className="size-4 text-ink" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cn("pencil-rule -mx-1 my-0.5", className)} {...props} />;
}

export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue };
