import * as React from "react";
import { cn } from "@/lib/utils";

type CountedOptionProps = Omit<React.ComponentProps<"span">, "children"> & {
  label: React.ReactNode;
  /** Omit when no cheap count exists; the "(n)" is then not drawn. */
  count?: number;
};

/** "Bullet (12)": label + tabular count. Inline spans only, so it can sit inside a chip or button. */
export function CountedOption({ label, count, className, ...props }: CountedOptionProps) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)} {...props}>
      <span>{label}</span>
      {count !== undefined && <span className="font-mono text-[0.85em] text-muted-foreground tabular-nums">({count})</span>}
    </span>
  );
}
