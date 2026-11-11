import * as React from "react";
import { cn } from "@/lib/utils";

type EmptySpecimenProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** Serif italic title, e.g. "No specimens collected here". */
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
};

/** Empty-state block: a dashed specimen-tag outline, serif italic title, muted hint, optional action. */
export function EmptySpecimen({ title, hint, action, className, ...props }: EmptySpecimenProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5 px-4 py-8 text-center", className)} {...props}>
      <svg width="40" height="52" viewBox="0 0 40 52" fill="none" aria-hidden="true" className="mb-1 text-rule-strong">
        <path
          d="M6 1.5h28a4.5 4.5 0 0 1 4.5 4.5v40a4.5 4.5 0 0 1-4.5 4.5H6A4.5 4.5 0 0 1 1.5 46V6A4.5 4.5 0 0 1 6 1.5Z"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeDasharray="3 3"
        />
        <circle cx="20" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.25" />
        <path d="M10 24h20M10 31h20M10 38h12" stroke="currentColor" strokeWidth="1" strokeOpacity="0.6" />
      </svg>
      <p className="font-serif text-lg leading-snug text-foreground italic">{title}</p>
      {hint && <p className="max-w-[28ch] text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
