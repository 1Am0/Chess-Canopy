import { cn } from "@/lib/utils";

/**
 * A small manila specimen tag on a loop of string, for short catalogue codes (the ECO code).
 * Pentagon-ish: two corners cut at the hole end, a reinforced punched hole, and the string
 * looping out of the hole to the left (so leave about 14px of room there). Drawn from a
 * clipped outline layer (darker edge) under a clipped fill, so the cut corners keep a hairline.
 * Sized to the content; the whole piece is 20px tall and tilted a degree and a half.
 * The code itself is real text (selectable, readable); only the paper bits are aria-hidden.
 */
export function StringTag({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span
      className={cn("relative inline-flex h-5 shrink-0 items-center pl-[14px]", className)}
      style={{ transform: "rotate(-1.5deg)" }}
      title={title}
    >
      {/* tag body: outline, then fill, then fibre */}
      <span
        aria-hidden
        className="paper-deco absolute inset-y-0 right-0 left-[3px] block"
        style={{
          background: "var(--tag-edge)",
          clipPath: "polygon(7px 0, 100% 0, 100% 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)",
          filter: "drop-shadow(0.5px 1px 0.7px color-mix(in oklab, var(--shadow-ink) 38%, transparent))",
        }}
      />
      <span
        aria-hidden
        className="paper-deco absolute inset-y-px right-px left-[4px] block"
        style={{
          backgroundColor: "var(--tag)",
          backgroundImage: "var(--sheet-tile)",
          clipPath: "polygon(6.3px 0, 100% 0, 100% 100%, 6.3px 100%, 0 calc(100% - 6.3px), 0 6.3px)",
        }}
      />
      {/* reinforced hole and the string through it */}
      <svg aria-hidden width="22" height="20" viewBox="0 0 22 20" className="paper-deco absolute top-0 left-0 block overflow-visible">
        <circle cx="9" cy="10" r="4.6" style={{ fill: "var(--tag-reinforce)", stroke: "var(--tag-edge)" }} strokeWidth="0.6" />
        <circle cx="9" cy="10" r="2.5" style={{ fill: "var(--sheet)", stroke: "var(--tag-edge)" }} strokeWidth="0.7" />
        <path
          d="M9 8.2C5.5 4.8 3.4 3.4 2.2 5C1.2 6.6 3.6 9.4 5.4 11.6C6.6 13.2 6.8 15.6 5.4 17"
          fill="none"
          strokeLinecap="round"
          strokeWidth="1.1"
          style={{ stroke: "var(--string)" }}
        />
        <path d="M9 11.8C7.4 11.4 6 10.6 4.8 9.6" fill="none" strokeLinecap="round" strokeWidth="1.1" style={{ stroke: "var(--string)" }} />
      </svg>
      <span className="relative pr-2 pl-[7px] font-mono text-[11px] leading-none font-semibold tracking-wide tabular-nums" style={{ color: "var(--tag-ink)" }}>
        {children}
      </span>
    </span>
  );
}
