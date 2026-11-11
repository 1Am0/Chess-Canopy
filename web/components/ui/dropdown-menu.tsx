"use client";
import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { InkTick } from "@/components/field/InkTick";
import { CardTape } from "@/components/ui/paper-chrome";
import { cn } from "@/lib/utils";
import { keepNavKeysLocal } from "@/components/ui/keys";

/*
 * Menus are index cards: a cream card over an offset second card, a strip of tape across the top, printed rows. The
 * highlighted row gets a marker wash (see `.paper-row`); checked items carry an ink tick that draws itself.
 */
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const ROW =
  "paper-row relative flex min-h-8 cursor-default items-center gap-2 rounded-none px-2 py-1 text-sm outline-hidden select-none focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

function DropdownMenuContent({
  className,
  children,
  sideOffset = 6,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        data-local-keys
        onKeyDown={(e) => {
          onKeyDown?.(e);
          keepNavKeysLocal(e);
        }}
        className={cn("paper-card relative z-50 min-w-[8rem] p-1 text-popover-foreground data-[state=open]:paper-settle", className)}
        {...props}
      >
        <CardTape seed="menu" />
        <div className="max-h-[calc(var(--radix-dropdown-menu-content-available-height)-1.5rem)] overflow-x-hidden overflow-y-auto">{children}</div>
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean; variant?: "default" | "destructive" }) {
  return (
    <DropdownMenuPrimitive.Item
      data-inset={inset}
      data-variant={variant}
      className={cn(
        ROW,
        "data-[inset]:pl-8 data-[variant=destructive]:text-loss-text data-[variant=destructive]:[--hilite:var(--hilite-pink)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  const seed = React.useId();
  return (
    <DropdownMenuPrimitive.CheckboxItem checked={checked} className={cn(ROW, "pr-2 pl-8", className)} {...props}>
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <InkTick seed={seed} draw className="size-4 text-ink" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  const seed = React.useId();
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(ROW, "pr-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      {children}
      <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <InkTick seed={seed} draw className="size-4 text-ink" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Label
      data-inset={inset}
      className={cn("kicker mb-0 px-2 pt-2 pb-1 data-[inset]:pl-8", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn("pencil-rule -mx-1 my-0.5", className)} {...props} />;
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("ml-auto font-mono text-[11px] tracking-wide text-muted-foreground", className)} {...props} />;
}

export {
  DropdownMenuShortcut,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
