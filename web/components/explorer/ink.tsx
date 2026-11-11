import { wobbleLine } from "@/lib/paper";
import { cn } from "@/lib/utils";

/**
 * Small hand-made marks shared by the explorer: a pencil underline, a margin tick, a sort arrow, a cross and a
 * slash. Each is a seeded wobbly stroke (identical on every render), decorative (aria-hidden) and hidden in
 * forced-colors mode by `paper-deco`.
 */

/** A pencilled underline under its positioned parent (absolute, so it never changes layout). */
export function PencilUnderline({ seed = 1, className, tone = "pencil" }: { seed?: number | string; className?: string; tone?: "pencil" | "ink" | "green" }) {
  const stroke = tone === "green" ? "var(--primary)" : tone === "ink" ? "var(--ink)" : "var(--pencil)";
  return (
    <svg
      aria-hidden
      className={cn("paper-deco pointer-events-none absolute inset-x-0 block h-[5px] w-full", className)}
      viewBox="0 0 120 5"
      preserveAspectRatio="none"
      style={{ width: "100%", height: 5 }}
    >
      <path d={wobbleLine(`pu-${seed}`, 1, 2.6, 119, 2.3, 0.9)} fill="none" strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ stroke, opacity: 0.8 }} />
      <path d={wobbleLine(`pv-${seed}`, 6, 3.8, 110, 3.4, 0.7)} fill="none" strokeWidth="0.9" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ stroke, opacity: 0.45 }} />
    </svg>
  );
}

/** A tiny pencilled tick mark (margin check). */
export function PencilTick({ seed = 1, className }: { seed?: number | string; className?: string }) {
  return (
    <svg aria-hidden width="9" height="9" viewBox="0 0 9 9" className={cn("paper-deco pointer-events-none block overflow-visible", className)}>
      <path d={wobbleLine(`pt-${seed}`, 0.8, 4.6, 3.2, 8, 0.3)} fill="none" strokeWidth="1.3" strokeLinecap="round" style={{ stroke: "var(--pencil)" }} />
      <path d={wobbleLine(`pq-${seed}`, 3.2, 8, 8.4, 0.8, 0.3)} fill="none" strokeWidth="1.3" strokeLinecap="round" style={{ stroke: "var(--pencil)" }} />
    </svg>
  );
}

/** A small inked arrow for sort direction. */
export function InkArrow({ dir, className }: { dir: "up" | "down"; className?: string }) {
  return (
    <svg
      aria-hidden
      width="8"
      height="10"
      viewBox="0 0 8 10"
      fill="none"
      className={cn("block shrink-0", className)}
      style={dir === "up" ? { transform: "rotate(180deg)" } : undefined}
    >
      <path d="M4.1 0.8C4 3 4.2 6 4 8.9" strokeWidth="1.4" strokeLinecap="round" style={{ stroke: "var(--ink)" }} />
      <path d="M1.3 6.1C2.4 7 3.4 8 4 9C4.7 8 5.7 7.1 6.8 6.2" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--ink)" }} />
    </svg>
  );
}

/** A hand-ruled little cross (remove). */
export function InkCross({ className, seed = 1 }: { className?: string; seed?: number | string }) {
  return (
    <svg aria-hidden width="9" height="9" viewBox="0 0 9 9" className={cn("block overflow-visible", className)}>
      <path d={wobbleLine(`xa-${seed}`, 1.4, 1.4, 7.6, 7.5, 0.35)} fill="none" strokeWidth="1.3" strokeLinecap="round" style={{ stroke: "currentColor" }} />
      <path d={wobbleLine(`xb-${seed}`, 7.5, 1.3, 1.5, 7.6, 0.35)} fill="none" strokeWidth="1.3" strokeLinecap="round" style={{ stroke: "currentColor" }} />
    </svg>
  );
}

/** A pencil slash between crumbs. */
export function PencilSlash({ seed = 1, className }: { seed?: number | string; className?: string }) {
  return (
    <svg aria-hidden width="6" height="12" viewBox="0 0 6 12" className={cn("paper-deco inline-block align-[-2px]", className)}>
      <path d={wobbleLine(`sl-${seed}`, 5, 1, 1, 11, 0.3)} fill="none" strokeWidth="1" strokeLinecap="round" style={{ stroke: "var(--pencil)", opacity: 0.6 }} />
    </svg>
  );
}
