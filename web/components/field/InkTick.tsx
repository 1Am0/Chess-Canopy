import { inkCheckPath } from "@/lib/paper";
import { cn } from "@/lib/utils";

/**
 * A hand-ruled check stroke (round caps, a little seeded unsteadiness) for checkbox, radio and menu indicators.
 * Decorative. `seed` varies the hand; `draw` animates the pen drawing it on when it mounts (off under reduced motion).
 */
export function InkTick({ className, seed = "tick", draw = false }: { className?: string; seed?: number | string; draw?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cn("size-4 shrink-0", className)}>
      <path d={inkCheckPath(seed)} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className={draw ? "ink-draw" : undefined} />
    </svg>
  );
}

/** Short ink dash for the indeterminate state. Decorative. */
export function InkDash({ className, draw = false }: { className?: string; draw?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cn("size-4 shrink-0", className)}>
      <path d="M4 8.2Q8 7.6 12 8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" pathLength={1} className={draw ? "ink-draw" : undefined} />
    </svg>
  );
}
