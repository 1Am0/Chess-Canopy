import * as React from "react";
import { cn } from "@/lib/utils";

export type MetaItem = { label: React.ReactNode; value: React.ReactNode };

/** Two-column definition list (Who / What / Where / When): muted terms, hairline rows. */
export function MetaGrid({ items, className, ...props }: { items: MetaItem[] } & Omit<React.ComponentProps<"dl">, "children">) {
  return (
    <dl className={cn("grid grid-cols-[max-content_1fr] gap-x-4 border-t border-border text-sm", className)} {...props}>
      {items.map((it, i) => (
        <div key={i} className="col-span-2 grid grid-cols-subgrid items-baseline border-b border-border py-1.5">
          <dt className="font-medium text-muted-foreground">{it.label}</dt>
          <dd className="min-w-0 tabular-nums">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
