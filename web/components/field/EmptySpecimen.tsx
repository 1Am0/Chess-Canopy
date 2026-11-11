import * as React from "react";
import { cn } from "@/lib/utils";

type EmptySpecimenProps = Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
};

/** Empty-state block: a title, a muted hint, an optional action. */
export function EmptySpecimen({ title, hint, action, className, ...props }: EmptySpecimenProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5 px-4 py-8 text-center", className)} {...props}>
      <p className="text-base leading-snug font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-[28ch] text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
