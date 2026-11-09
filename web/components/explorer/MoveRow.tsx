import type { Color, NextMove } from "@/lib/engine/types";
import { WdbBar } from "@/components/explorer/WdbBar";
import { scoreTextClass } from "@/components/explorer/wdb";
import { compact, pct, score } from "@/lib/format";
import { shareLabel } from "@/lib/explorer-format";
import { cn } from "@/lib/utils";

/**
 * Column classes shared by the header, the move rows, the total row and the skeleton,
 * so every row lines up and has the same single-line 32px geometry. Share shows from a
 * 24rem wide table and the inline opening name from 28rem (else it is only a tooltip).
 */
export const COL = {
  move: "overflow-hidden whitespace-nowrap pr-2 pl-3",
  games: "w-16 px-2 text-right tabular-nums whitespace-nowrap",
  share: "hidden w-14 px-2 text-right tabular-nums whitespace-nowrap @sm:table-cell",
  bar: "w-[38%] px-2",
  score: "w-14 pr-3 pl-1 text-right tabular-nums whitespace-nowrap",
} as const;

export function MoveRow({
  id,
  item,
  side,
  positionTotal,
  active,
  openingName,
  rare,
  onPlay,
  onHover,
}: {
  id: string;
  item: NextMove;
  side: Color;
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
      className={cn("h-8 cursor-pointer transition-colors even:bg-muted/45 hover:bg-accent/80", active && "bg-accent even:bg-accent")}
    >
      <td className={cn(COL.move, active && "shadow-[inset_2px_0_0_var(--color-primary)]")} title={openingName ?? undefined}>
        <div className={cn("flex min-w-0 items-baseline gap-2", dim && "text-muted-foreground")}>
          <span className="shrink-0 font-mono text-sm font-semibold">{item.move}</span>
          {openingName && <span className="hidden min-w-0 truncate text-xs text-muted-foreground @md:inline">{openingName}</span>}
        </div>
      </td>
      <td className={cn(COL.games, "text-[13px]", dim && "text-muted-foreground")}>{compact(item.stats.total)}</td>
      <td className={cn(COL.share, "text-xs text-muted-foreground")}>{shareLabel(item.stats.total, positionTotal)}</td>
      <td className={cn(COL.bar, dim && "opacity-75")}>
        <WdbBar stats={item.stats} side={side} />
      </td>
      <td className={cn(COL.score, "text-[13px] font-semibold", scoreTextClass(sc, item.stats.total))}>{pct(sc)}</td>
    </tr>
  );
}
