import * as React from "react";
import { cn } from "@/lib/utils";

type LeaderProps = Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode;
  /** The value, right aligned. */
  children: React.ReactNode;
};

/** Label ........ value row with a dotted leader (key to symbols, register lines). */
export function Leader({ label, children, className, ...props }: LeaderProps) {
  return (
    <div className={cn("flex items-baseline gap-2 text-sm", className)} {...props}>
      <span className="shrink-0">{label}</span>
      <span className="leader" aria-hidden="true" />
      <span className="shrink-0 tabular-nums">{children}</span>
    </div>
  );
}
