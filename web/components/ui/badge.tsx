import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border px-1.5 py-0.5 font-mono text-[11px] leading-4 font-medium whitespace-nowrap tabular-nums [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-rule-strong bg-specimen text-foreground",
        secondary: "border-rule bg-secondary text-secondary-foreground",
        destructive: "border-loss bg-specimen text-loss-text",
        outline: "border-rule-strong bg-specimen text-foreground",
        stamp: "stamp rounded-sm border-[3px] border-double border-current bg-transparent px-1.5 py-px",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
