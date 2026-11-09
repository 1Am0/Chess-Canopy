import type { NextMove } from "@/lib/engine/types";
import { WdlBar } from "@/components/explorer/WdlBar";
import { compact, pct, score } from "@/lib/format";
import { scoreClass, shareLabel } from "@/lib/explorer-format";
import { cn } from "@/lib/utils";

export function MoveRow({
  id,
  item,
  positionTotal,
  active,
  openingName,
  rare,
  onPlay,
  onHover,
}: {
  id: string;
  item: NextMove;
  positionTotal: number;
  active: boolean;
  /** Opening reached by this move, only when it differs from the current one */
  openingName?: string | null;
  rare?: boolean;
  onPlay: () => void;
  onHover: (hover: boolean) => void;
}) {
  const sc = score(item.stats);
  const dim = rare || item.stats.total < 3;
  return (
    <tr
      id={id}
      onClick={onPlay}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      aria-selected={active}
      className={cn(
        "group cursor-pointer border-t transition-colors hover:bg-accent/70",
        active && "bg-accent shadow-[inset_2px_0_0_var(--color-primary)]",
      )}
    >
      <td className={cn("max-w-0 min-w-16 py-1.5 pr-2 pl-3", dim && "opacity-60")}>
        <div className="font-mono text-[15px] leading-tight font-semibold">{item.move}</div>
        {openingName && (
          <div className="truncate text-[11px] leading-tight text-muted-foreground" title={openingName}>
            {openingName}
          </div>
        )}
      </td>
      <td className={cn("px-2 text-right text-sm tabular-nums", dim && "opacity-60")}>{compact(item.stats.total)}</td>
      <td className={cn("hidden px-2 text-right text-sm tabular-nums text-muted-foreground sm:table-cell", dim && "opacity-60")}>
        {shareLabel(item.stats.total, positionTotal)}
      </td>
      <td className={cn("px-2", dim && "opacity-60")}>
        <WdlBar stats={item.stats} />
      </td>
      <td className={cn("py-1.5 pr-3 pl-1 text-right text-sm font-medium tabular-nums", scoreClass(sc), dim && "opacity-70")}>
        {pct(sc)}
      </td>
    </tr>
  );
}
