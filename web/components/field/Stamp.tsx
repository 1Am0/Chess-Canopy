import * as React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  primary: "",
  muted: "[--stamp:var(--muted-foreground)]",
  destructive: "[--stamp:var(--loss-text)]",
} as const;

type StampProps = React.ComponentProps<"span"> & { tone?: keyof typeof TONES };

/** Rotated (-1.5deg) double-border mono stamp: "Default", "Deleted", a date. Crisp, no texture. */
export function Stamp({ tone = "primary", className, ...props }: StampProps) {
  return <span className={cn("stamp", TONES[tone], className)} {...props} />;
}
