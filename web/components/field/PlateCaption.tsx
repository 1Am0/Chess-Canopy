import * as React from "react";
import { cn } from "@/lib/utils";

type PlateCaptionProps = React.ComponentProps<"p"> & {
  /** Figure number or label. Only pass something a user could cite. Omit for a bare caption. */
  fig?: React.ReactNode;
  as?: "p" | "figcaption" | "div";
};

/** "Fig. 2 — " + an italic serif caption, as under a printed plate. */
export function PlateCaption({ fig, as: Comp = "p", className, children, ...props }: PlateCaptionProps) {
  return (
    <Comp className={cn("flex items-baseline gap-1.5 text-sm text-muted-foreground", className)} {...(props as React.HTMLAttributes<HTMLElement>)}>
      {fig !== undefined && (
        <>
          <span className="label-caps shrink-0 tabular-nums">Fig. {fig}</span>
          <span aria-hidden="true">&mdash;</span>
        </>
      )}
      <span className="font-serif italic">{children}</span>
    </Comp>
  );
}
