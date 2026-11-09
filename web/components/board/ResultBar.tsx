"use client";

import { useExplorerStore } from "@/lib/store";
import { pct } from "@/lib/format";
import type { Color } from "@/lib/engine/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const seg = "w-full shrink-0 motion-safe:transition-[height] motion-safe:duration-[800ms] motion-safe:ease-in-out";

/**
 * Lichess-style evaluation bar. Stats are from the player's side, so they are converted to
 * White / Black. White's segment sits at White's end of the board, Black's at the other end.
 */
export function ResultBar({ side, orientation }: { side: Color; orientation: Color }) {
  const stats = useExplorerStore((s) => s.result?.stats);
  const has = !!stats && stats.total > 0;
  const whiteRate = has ? (side === "white" ? stats.winRate : stats.lossRate) : 0;
  const blackRate = has ? (side === "white" ? stats.lossRate : stats.winRate) : 0;
  const drawRate = has ? stats.drawRate : 0;
  const label = has
    ? `White ${pct(whiteRate)} · Draw ${pct(drawRate)} · Black ${pct(blackRate)}`
    : "No games";
  const whiteAtBottom = orientation === "white";

  const white = <div key="w" className={seg} style={{ height: `${whiteRate * 100}%`, background: "var(--eval-white, #fff)" }} />;
  const draw = <div key="d" className={seg} style={{ height: `${drawRate * 100}%`, background: "var(--eval-draw, #9a9a9a)" }} />;
  const black = <div key="b" className={seg} style={{ height: `${blackRate * 100}%`, background: "var(--eval-black, #403d39)" }} />;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="img"
          aria-label={label}
          data-testid="result-bar"
          className="flex h-full w-2.5 flex-col overflow-hidden rounded-[3px] sm:w-3"
          style={{
            border: "1px solid var(--eval-border, rgb(0 0 0 / .2))",
            ...(has
              ? { background: "var(--eval-draw, #9a9a9a)" }
              : {
                  backgroundImage:
                    "repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in oklab, var(--eval-draw, #9a9a9a) 40%, transparent) 4px 8px)",
                }),
          }}
        >
          {has && (whiteAtBottom ? [black, draw, white] : [white, draw, black])}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
