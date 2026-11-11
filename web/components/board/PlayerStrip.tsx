import type { Color } from "@/lib/engine/types";

/** The side as a small dot: filled for Black, an outlined ring for White. */
function SideDot({ color }: { color: Color }) {
  return (
    <span
      aria-hidden
      className={`size-3 shrink-0 rounded-full border border-bar-border ${color === "black" ? "bg-bar-black" : "bg-bar-white"}`}
    />
  );
}

/** Fixed-height, single-line strip: nothing here may change the layout when the text changes. */
export function PlayerStrip({ you, color }: { you: boolean; color: Color }) {
  return (
    <div className="flex h-7 min-h-7 min-w-0 items-center gap-2 overflow-hidden px-px whitespace-nowrap text-sm">
      <SideDot color={color} />
      <span className={`min-w-0 shrink truncate rounded-sm border px-1.5 text-xs leading-5 font-medium ${you ? "border-primary bg-accent text-accent-foreground" : "border-border bg-secondary text-foreground"}`}>
        {you ? "You" : "Opponents"}
      </span>
      <span className="label-caps min-w-[7ch] truncate font-mono text-xs tabular-nums">
        · {color === "white" ? "White" : "Black"}
      </span>
    </div>
  );
}
