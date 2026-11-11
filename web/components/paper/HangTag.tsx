import { cn } from "@/lib/utils";

/**
 * The body of a manila hang tag on a loop of string: the same drawing as StringTag (cut corners at the hole end, a
 * reinforced punched hole, one strand looping up to a knot, one hanging and fraying) but it grows with its text, so it
 * can hold a tooltip. Leave ~19px of room on the left (it brings its own). Text is mono-free sans 12px in tag ink.
 * Used by `TooltipContent`; use it directly for any short note that should hang off something.
 */
export function HangTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-flex min-h-[22px] items-center pl-[19px]", className)}>
      <span
        aria-hidden
        className="paper-deco absolute inset-y-0 right-0 left-[6px] block"
        style={{
          background: "var(--tag-edge)",
          clipPath: "polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)",
          filter: "drop-shadow(0.6px 1.2px 0.8px color-mix(in oklab, var(--shadow-ink) 45%, transparent))",
        }}
      />
      <span
        aria-hidden
        className="paper-deco absolute inset-y-px right-px left-[7px] block"
        style={{
          backgroundColor: "var(--tag)",
          backgroundImage: "var(--sheet-tile)",
          clipPath: "polygon(7.3px 0, 100% 0, 100% 100%, 7.3px 100%, 0 calc(100% - 7.3px), 0 7.3px)",
        }}
      />
      <svg aria-hidden width="30" height="22" viewBox="0 0 30 22" className="paper-deco absolute top-0 left-0 block overflow-visible">
        <circle cx="14" cy="11" r="5.2" style={{ fill: "var(--tag-reinforce)", stroke: "var(--tag-edge)" }} strokeWidth="0.6" />
        <circle cx="14" cy="11" r="2.7" style={{ fill: "var(--sheet)", stroke: "var(--tag-edge)" }} strokeWidth="0.8" />
        <path d="M14 9.2C11 6.4 6.6 3.6 3.6 4.6C1.6 5.3 1.7 8 3.6 8.6" fill="none" strokeLinecap="round" strokeWidth="1.15" style={{ stroke: "var(--string)" }} />
        <circle cx="3.6" cy="8.7" r="1.35" style={{ fill: "var(--string)" }} />
        <path d="M14 12.6C11.4 14.8 8.2 15.4 6.2 17.4C5 18.6 4.8 20 5.4 21" fill="none" strokeLinecap="round" strokeWidth="1.15" style={{ stroke: "var(--string)" }} />
        <path d="M5.4 21L3.9 21.6M5.4 21L6.8 21.8" fill="none" strokeLinecap="round" strokeWidth="0.7" style={{ stroke: "var(--string)" }} />
        <path d="M11.4 9.3C13.2 8.6 15.2 9.2 16.2 11" fill="none" strokeLinecap="round" strokeWidth="0.9" style={{ stroke: "var(--string)" }} />
      </svg>
      <span className="relative py-0.5 pr-2.5 pl-[10px] text-xs leading-[18px] [&_kbd]:rounded-[2px] [&_kbd]:border [&_kbd]:border-[var(--tag-edge)] [&_kbd]:bg-[var(--tag-reinforce)] [&_kbd]:px-1 [&_kbd]:font-mono [&_kbd]:text-[10px] [&_kbd]:text-[var(--tag-ink)]" style={{ color: "var(--tag-ink)" }}>
        {children}
      </span>
    </span>
  );
}
