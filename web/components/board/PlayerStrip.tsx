import type { Color } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

export function PlayerStrip({ you, color, games }: { you: boolean; color: Color; games: number }) {
  return (
    <div className="flex h-7 min-w-0 items-center gap-2 text-sm">
      <span
        aria-hidden
        className={cn(
          "size-3 shrink-0 rounded-full ring-1 ring-foreground/40",
          color === "white" ? "bg-white" : "bg-neutral-900",
        )}
      />
      <span className="truncate font-semibold">{you ? "You" : "Opponents"}</span>
      <span className="truncate text-xs text-muted-foreground">
        {you ? `· ${color === "white" ? "White" : "Black"}` : `· ${games.toLocaleString()} ${games === 1 ? "game" : "games"}`}
      </span>
    </div>
  );
}
