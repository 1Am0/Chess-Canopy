import * as React from "react";
import { cn } from "@/lib/utils";

/** Mono catalogue/accession code in a hairline box on the specimen ground (ECO code, source, "No. 014"). */
export function SpecimenTag({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-sm border border-rule-strong bg-specimen px-1.5 font-mono text-[11px] leading-5 whitespace-nowrap text-foreground tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
