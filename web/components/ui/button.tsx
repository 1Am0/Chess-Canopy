import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Paper buttons: a cut piece of card with a printed ink edge (see `.paper-btn` in globals.css). Pressed or open
 * looks like the card pushed into the page; focus is a crisp outline, not a glow. Primary is a solid forest-green
 * printed label. `ghost` stays bare until hovered; `chit` is an always-visible round token for icon buttons.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[2px] text-sm font-medium whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "paper-btn paper-btn-primary",
        destructive: "paper-btn paper-btn-primary [--primary-foreground:var(--destructive-foreground)] [--primary:var(--destructive)]",
        outline: "paper-btn text-foreground",
        secondary: "paper-btn paper-btn-quiet text-secondary-foreground",
        ghost: "paper-btn paper-btn-ghost text-foreground",
        chit: "paper-btn paper-btn-chit text-foreground",
        tag: "paper-btn paper-btn-tag font-mono text-[11px] tracking-[0.12em] text-foreground uppercase",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        xs: "h-6 gap-1 rounded-[2px] px-2",
        sm: "h-8 gap-1.5 px-3",
        lg: "h-10 px-6",
        icon: "size-9",
      },
    },
    compoundVariants: [{ variant: "chit", size: "icon", className: "rounded-full" }],
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
