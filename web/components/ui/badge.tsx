import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* Accession labels: small pasted slips of paper (fibre, hairline edge, tiny shadow), mono caps-free figures. `stamp` is an inked rubber stamp. */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[1px] px-1.5 py-0.5 font-mono text-[11px] leading-4 font-medium whitespace-nowrap tabular-nums [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "paper-label text-foreground",
        secondary: "paper-label text-secondary-foreground [--btn-edge:var(--muted-foreground)]",
        destructive: "paper-label text-loss-text [--btn-edge:var(--loss-text)]",
        outline: "paper-label text-foreground",
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
