import { cn } from "@/lib/utils";

/**
 * Chess Canopy logomark: a pawn whose head is a three-lobed tree canopy.
 * Single-colour (currentColor) so it can be ink or primary; decorative by default.
 * Keep the geometry in sync with app/icon.svg.
 */
export function Logo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-6 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {/* canopy: three lobes */}
      <circle cx="8.4" cy="8.6" r="3.3" />
      <circle cx="15.6" cy="8.6" r="3.3" />
      <circle cx="12" cy="5.6" r="3.7" />
      <rect x="8.6" y="8.6" width="6.8" height="3.4" />
      {/* collar, stem, base */}
      <rect x="8" y="11.6" width="8" height="1.8" rx="0.9" />
      <path d="M10.2 13.2h3.6l1 5.6H9.2z" />
      <rect x="6" y="18.4" width="12" height="2.6" rx="1.3" />
    </svg>
  );
}
