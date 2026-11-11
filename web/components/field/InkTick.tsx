import { cn } from "@/lib/utils";

/** Hand-ruled check stroke used by checkbox, radio and select indicators. Decorative. */
export function InkTick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cn("size-4 shrink-0", className)}>
      <path d="M3 8.6 6.4 12 13 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

/** Short ink dash for the indeterminate state. Decorative. */
export function InkDash({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cn("size-4 shrink-0", className)}>
      <path d="M4 8h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}
