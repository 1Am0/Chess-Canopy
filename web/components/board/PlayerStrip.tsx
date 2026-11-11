import { PaperLabel } from "@/components/paper";
import { createRng, inkEllipsePath, n2 } from "@/lib/paper";
import type { Color } from "@/lib/engine/types";

/** A blot of ink: a closed, slightly lumpy circle, always the same lumps. */
const BLOT = (() => {
  const rng = createRng("dot-black");
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    const r = 5.4 + rng.range(-0.5, 0.5);
    return `${i ? "L" : "M"}${n2(7 + Math.cos(a) * r)} ${n2(7 + Math.sin(a) * r)}`;
  });
  return `${pts.join("")}Z`;
})();

/** The side as an ink dot: a blot of ink for Black, a pen-drawn ring on cream for White. Seeded, so it never shakes. */
function SideDot({ color }: { color: Color }) {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" className="shrink-0 overflow-visible">
      {color === "black" ? (
        <path d={BLOT} style={{ fill: "var(--bar-black)", stroke: "var(--bar-black)" }} strokeWidth="1" strokeLinejoin="round" />
      ) : (
        <>
          <circle cx="7" cy="7" r="5" style={{ fill: "var(--bar-white)" }} />
          <path d={inkEllipsePath("dot-white", 14, 14, { pad: 2.4, turns: 1.1 })} fill="none" strokeWidth="1.3" strokeLinecap="round" style={{ stroke: "var(--ink)" }} />
        </>
      )}
    </svg>
  );
}

/** Fixed-height, single-line strip: nothing here may change the layout when the text changes. */
export function PlayerStrip({ you, color }: { you: boolean; color: Color }) {
  return (
    <div className="flex h-7 min-h-7 min-w-0 items-center gap-2 overflow-hidden px-px whitespace-nowrap text-sm">
      <SideDot color={color} />
      {/* a typed label pasted on the mat */}
      <PaperLabel tone={you ? "manila" : "cream"} rotate={you ? -0.6 : 0.5} className="min-w-0 shrink truncate text-[12px] font-medium">
        {you ? "You" : "Opponents"}
      </PaperLabel>
      <span className="label-caps min-w-[7ch] truncate font-mono text-[11px] tabular-nums">
        · {color === "white" ? "White" : "Black"}
      </span>
    </div>
  );
}
