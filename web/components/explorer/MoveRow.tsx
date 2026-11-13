import type { Color, NextMove } from "@/lib/engine/types";
import { WdbBar } from "@/components/explorer/WdbBar";
import { isGoodScore, scoreChipColor } from "@/components/explorer/wdb";
import { compact, pct, score } from "@/lib/format";
import { shareLabel } from "@/lib/explorer-format";
import { PencilTick } from "@/components/explorer/ink";
import { cn } from "@/lib/utils";

/**
 * Column classes shared by the header, the move rows, the total row and the skeleton, so every row lines up and
 * has the same fixed 40px geometry. The outer columns use the panel's 12px padding so the table text lines up
 * with the header text above it. Share shows from a 28rem wide table.
 */
export const COL = {
  move: "overflow-hidden whitespace-nowrap pr-1 pl-3 @xs:pr-2",
  games: "w-12 pr-2 pl-1 text-right @xs:w-14 tabular-nums whitespace-nowrap",
  share: "hidden w-14 px-2 text-right tabular-nums whitespace-nowrap @md:table-cell",
  bar: "w-[36%] px-1 @xs:w-[38%] @xs:px-2",
  score: "w-16 pr-3 pl-1 text-right tabular-nums whitespace-nowrap",
} as const;

/** The score as a small chip on the continuous red / sand / green scale (text stays dark ink). */
export function ScoreChip({ sc, total, pop = false }: { sc: number; total: number; pop?: boolean }) {
  if (!total) return <span className="text-muted-foreground">–</span>;
  const good = pop && isGoodScore(sc, total);
  return (
    <span className="score-chip" data-good={good || undefined} style={{ backgroundColor: scoreChipColor(sc) }}>
      {pct(sc)}
    </span>
  );
}

export function MoveRow({
  id,
  item,
  side,
  positionTotal,
  active,
  openingName,
  index = 0,
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
  index?: number;
  onPlay: () => void;
  onHover: (hover: boolean) => void;
}) {
  const sc = score(item.stats);
  const delay = Math.min(index, 12) * 28;
  return (
    <tr
      id={id}
      onClick={onPlay}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      aria-selected={active}
      style={{ animationDelay: `${delay}ms` }}
      className={cn("row-in group/row relative isolate h-10 cursor-pointer [&>td]:border-b [&>td]:border-rule", active && "[&>td]:border-transparent")}
    >
      <td className={COL.move} title={openingName ? `${item.move}: ${openingName}` : undefined}>
        {/* One indicator for hover and keyboard selection: a marker band that swipes in, and a pencil tick in the margin. */}
        <span aria-hidden className="row-wash" />
        <PencilTick seed={item.move} className="row-tick absolute top-1/2 left-0 -translate-y-1/2" />
        <div className="flex min-w-0 flex-col justify-center leading-tight text-ink motion-safe:transition-transform motion-safe:duration-150 motion-safe:group-hover/row:translate-x-0.5">
          <span className="font-mono text-sm font-semibold">{item.move}</span>
          {openingName && <span className="block min-w-0 truncate font-serif text-xs text-muted-foreground italic">{openingName}</span>}
        </div>
      </td>
      <td className={cn(COL.games, "text-sm")}>{compact(item.stats.total)}</td>
      <td className={cn(COL.share, "text-xs text-muted-foreground")}>{shareLabel(item.stats.total, positionTotal)}</td>
      <td className={COL.bar}>
        <WdbBar stats={item.stats} side={side} seed={item.move} delay={delay + 60} />
      </td>
      <td className={cn(COL.score, "text-sm")}>
        <ScoreChip sc={sc} total={item.stats.total} pop />
      </td>
    </tr>
  );
}
