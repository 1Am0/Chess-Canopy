import * as React from "react";
import { cn } from "@/lib/utils";

type KickerProps = React.ComponentProps<"p"> & { as?: "p" | "span" | "div" | "h2" | "h3" | "h4" };

/** Small muted label above a title. */
export function Kicker({ as: Comp = "p", className, ...props }: KickerProps) {
  return <Comp className={cn("kicker", className)} {...(props as React.HTMLAttributes<HTMLElement>)} />;
}
