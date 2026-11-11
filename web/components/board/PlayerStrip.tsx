import type { Color } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

/** Fixed-height, single-line strip: nothing here may change the layout when the text changes. */
export function PlayerStrip({ you, color }: { you: boolean; color: Color }) {
  return (
    <div className="flex h-7 min-h-7 min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-sm">
      <span
        aria-hidden
        className={cn(
          "size-3 shrink-0 rounded-full ring-1 ring-foreground/40",
          color === "white" ? "bg-white" : "bg-neutral-900",
        )}
      />
      <span className="truncate font-sans font-medium text-ink">{you ? "You" : "Opponents"}</span>
      <span className="label-caps min-w-[7ch] truncate text-[13px] tabular-nums">
        · {color === "white" ? "White" : "Black"}
      </span>
    </div>
  );
}
