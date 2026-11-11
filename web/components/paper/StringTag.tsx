import { cn } from "@/lib/utils";

/**
 * A small manila specimen tag on a loop of string, for short catalogue codes (the ECO code).
 * Two corners are cut at the hole end, a reinforced washer is punched round the hole, and
 * a string runs through it: one strand loops up to a knot, the other hangs with a frayed end
 * (leave about 18px of room on the left). The body is a clipped outline layer under a clipped
 * fill (so the cut corners keep a hairline) with the paper fibre tile on top.
 * 22px tall, tilted a degree and a half. The code is real text; only the paper bits are aria-hidden.
 */
export function StringTag({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span
      className={cn("relative inline-flex h-[22px] shrink-0 items-center pl-[19px]", className)}
      style={{ transform: "rotate(-1.5deg)" }}
      title={title}
    >
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
        {/* reinforcement washer and the hole */}
        <circle cx="14" cy="11" r="5.2" style={{ fill: "var(--tag-reinforce)", stroke: "var(--tag-edge)" }} strokeWidth="0.6" />
        <circle cx="14" cy="11" r="2.7" style={{ fill: "var(--sheet)", stroke: "var(--tag-edge)" }} strokeWidth="0.8" />
        {/* strand 1: out of the hole, up and round to a knot */}
        <path d="M14 9.2C11 6.4 6.6 3.6 3.6 4.6C1.6 5.3 1.7 8 3.6 8.6" fill="none" strokeLinecap="round" strokeWidth="1.15" style={{ stroke: "var(--string)" }} />
        <circle cx="3.6" cy="8.7" r="1.35" style={{ fill: "var(--string)" }} />
        {/* strand 2: through the hole and hanging, fraying at the end */}
        <path d="M14 12.6C11.4 14.8 8.2 15.4 6.2 17.4C5 18.6 4.8 20 5.4 21" fill="none" strokeLinecap="round" strokeWidth="1.15" style={{ stroke: "var(--string)" }} />
        <path d="M5.4 21L3.9 21.6M5.4 21L6.8 21.8" fill="none" strokeLinecap="round" strokeWidth="0.7" style={{ stroke: "var(--string)" }} />
        {/* thread passing over the washer */}
        <path d="M11.4 9.3C13.2 8.6 15.2 9.2 16.2 11" fill="none" strokeLinecap="round" strokeWidth="0.9" style={{ stroke: "var(--string)" }} />
      </svg>
      <span className="relative pr-2 pl-[10px] font-mono text-[11px] leading-none font-semibold tracking-wide tabular-nums" style={{ color: "var(--tag-ink)" }}>
        {children}
      </span>
    </span>
  );
}
