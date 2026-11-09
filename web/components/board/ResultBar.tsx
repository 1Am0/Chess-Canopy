"use client";

import { useExplorerStore } from "@/lib/store";
import { pct } from "@/lib/format";
import type { Color } from "@/lib/engine/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const seg = "w-full transition-[height] duration-300 ease-out";

/** Vertical W/D/L bar beside the board. Your wins sit at your end of the board. */
export function ResultBar({ side, orientation }: { side: Color; orientation: Color }) {
  const stats = useExplorerStore((s) => s.result?.stats);
  const has = !!stats && stats.total > 0;
  const w = has ? stats.winRate * 100 : 0;
  const d = has ? stats.drawRate * 100 : 0;
  const l = has ? stats.lossRate * 100 : 0;
  const label = has
    ? `Win ${pct(stats.winRate)} · Draw ${pct(stats.drawRate)} · Loss ${pct(stats.lossRate)}`
    : "No games in this position";
  const youAtBottom = orientation === side;

  const win = <div key="w" className={seg} style={{ height: `${w}%`, background: "var(--color-win)" }} />;
  const draw = <div key="d" className={seg} style={{ height: `${d}%`, background: "var(--color-draw)" }} />;
  const loss = <div key="l" className={seg} style={{ height: `${l}%`, background: "var(--color-loss)" }} />;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="img"
          aria-label={label}
          data-testid="result-bar"
          className="flex h-full w-3 flex-col overflow-hidden rounded-full bg-muted shadow-inner ring-1 ring-border"
          style={
            has
              ? undefined
              : { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in oklab, var(--color-draw) 35%, transparent) 4px 8px)" }
          }
        >
          {has && (youAtBottom ? [loss, draw, win] : [win, draw, loss])}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
