import type { NextMove } from "@/lib/engine/types";
import { WdlBar } from "@/components/explorer/WdlBar";
import { compact, pct, score } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MoveRow({
  id,
  item,
  positionTotal,
  active,
  onPlay,
  onHover,
}: {
  id: string;
  item: NextMove;
  positionTotal: number;
  active: boolean;
  onPlay: () => void;
  onHover: (hover: boolean) => void;
}) {
  const sc = score(item.stats);
  const lowSample = item.stats.total < 3;
  return (
    <tr
      id={id}
      onClick={onPlay}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      aria-selected={active}
      className={cn(
        "group cursor-pointer border-t transition-colors hover:bg-accent/70",
        active && "bg-accent ring-1 ring-inset ring-ring/60",
      )}
    >
      <td className={cn("py-1.5 pr-2 pl-3 font-mono text-[15px] font-semibold", lowSample && "opacity-55")}>
        {item.move}
      </td>
      <td className={cn("px-2 text-right text-sm tabular-nums", lowSample && "opacity-55")}>{compact(item.stats.total)}</td>
      <td className={cn("px-2 text-right text-sm tabular-nums text-muted-foreground", lowSample && "opacity-55")}>
        {positionTotal ? pct(item.stats.total / positionTotal) : "–"}
      </td>
      <td className={cn("w-full min-w-24 px-2", lowSample && "opacity-50")}>
        <WdlBar stats={item.stats} />
      </td>
      <td
        className={cn(
          "py-1.5 pr-3 pl-1 text-right text-sm font-medium tabular-nums",
          sc >= 0.55 ? "text-win" : sc <= 0.45 ? "text-loss" : "text-foreground",
          lowSample && "opacity-55",
        )}
      >
        {pct(sc)}
      </td>
    </tr>
  );
}
