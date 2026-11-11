import { cn } from "@/lib/utils";

/** A placeholder drawn as pencilled ruled lines (a seeded wobbly pencil stroke tile), gently pulsing; still under reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("skeleton-lines animate-pulse rounded-sm motion-reduce:animate-none", className)} {...props} />;
}

export { Skeleton };
