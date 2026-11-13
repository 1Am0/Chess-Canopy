"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type FieldSectionProps = Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode;
  /** When given, a small "Clear" text link appears at the right of the heading while the group is not at its default. */
  onClear?: () => void;
  clearLabel?: string;
  /** True when the group is already at its default: the Clear link is then not shown (the heading row keeps its height). */
  clearDisabled?: boolean;
};

/** A labelled group with a hairline above: kicker heading, optional per-group Clear, then content. */
export function FieldSection({
  title,
  onClear,
  clearLabel = "Clear",
  clearDisabled,
  className,
  children,
  ...props
}: FieldSectionProps) {
  const id = React.useId();
  return (
    <section
      aria-labelledby={id}
      className={cn("flex flex-col gap-2.5 border-t border-rule pt-4 first:border-t-0 first:pt-0", className)}
      {...props}
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 id={id} className="kicker mb-0">
          {title}
        </h3>
        {onClear && !clearDisabled && (
          <button
            type="button"
            onClick={onClear}
            aria-label={typeof title === "string" ? `${clearLabel} ${title.toLowerCase()}` : undefined}
            className="-my-2 -mr-1 rounded-[2px] px-1 py-2 text-xs text-primary underline underline-offset-2 outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring max-sm:py-3"
          >
            {clearLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
