import { cn } from "@/lib/utils";

/** A flat gray placeholder block. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("rounded-sm bg-border", className)} {...props} />;
}

export { Skeleton };
