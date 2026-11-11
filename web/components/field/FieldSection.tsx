"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FieldSectionProps = Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode;
  /** When given, a small "Clear" button appears at the right of the heading. */
  onClear?: () => void;
  clearLabel?: string;
  /** Disable the clear button when the group is already at its default. */
  clearDisabled?: boolean;
};

/** A labelled group with a hairline above: heading, optional per-group Clear, then content. */
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
      className={cn("flex flex-col gap-2.5 border-t border-border pt-4 first:border-t-0 first:pt-0", className)}
      {...props}
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 id={id} className="kicker mb-0">
          {title}
        </h3>
        {onClear && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onClear}
            disabled={clearDisabled}
            aria-label={typeof title === "string" ? `${clearLabel} ${title.toLowerCase()}` : undefined}
          >
            {clearLabel}
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}
