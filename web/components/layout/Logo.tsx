import { cn } from "@/lib/utils";

/**
 * Chess Canopy logomark: a three-tier tree. Single path in currentColor;
 * decorative unless a title is given. Keep the path in sync with app/icon.svg.
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
      <path d="M12 1.5 18 9h-3l5 6.5h-6.8V22h-2.4v-6.5H4L9 9H6z" />
    </svg>
  );
}
