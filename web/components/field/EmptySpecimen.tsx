import * as React from "react";
import { cn } from "@/lib/utils";

type EmptySpecimenProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** Serif italic title, e.g. "No specimens collected here". */
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
};

/**
 * Empty-state block: a blank index card held by a bit of tape with a few pencilled rules and nothing written on them,
 * a serif italic title, a muted hint, an optional action. The card is decorative (aria-hidden); the text carries the meaning.
 */
export function EmptySpecimen({ title, hint, action, className, ...props }: EmptySpecimenProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5 px-4 py-8 text-center", className)} {...props}>
      <span aria-hidden className="paper-label mb-2 block h-[58px] w-[46px] px-1.5 pt-3.5" data-taped="true" style={{ transform: "rotate(-1.5deg)" }}>
        <span className="pencil-rule block" />
        <span className="pencil-rule block" />
        <span className="pencil-rule block w-2/3" />
      </span>
      <p className="font-serif text-lg leading-snug text-foreground italic">{title}</p>
      {hint && <p className="max-w-[28ch] text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
