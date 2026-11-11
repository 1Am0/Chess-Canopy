import type { Color, NextMove } from "@/lib/engine/types";
import { WdbBar } from "@/components/explorer/WdbBar";
import { scoreTextClass } from "@/components/explorer/wdb";
import { compact, pct, score } from "@/lib/format";
import { shareLabel } from "@/lib/explorer-format";
import { PencilTick } from "@/components/explorer/ink";
import { HighlighterWash } from "@/components/paper";
import { isLowSample } from "@/components/explorer/rare";
import { cn } from "@/lib/utils";

/**
 * Column classes shared by the header, the move rows, the total row and the skeleton,
 * so every row lines up and has the same single-line 32px geometry. Share shows from a
 * 24rem wide table and the inline opening name from 28rem (else it is only a tooltip).
 */
export const COL = {
  move: "overflow-hidden whitespace-nowrap pr-1 pl-4 @xs:pr-2",
  games: "w-12 pr-2 pl-1 text-right @xs:w-16 @xs:px-2 tabular-nums whitespace-nowrap",
  share: "hidden w-14 px-2 text-right tabular-nums whitespace-nowrap @sm:table-cell",
  bar: "w-[36%] px-1 @xs:w-[38%] @xs:px-2",
  score: "w-12 pr-2 pl-1 @xs:w-14 @xs:pr-3 text-right tabular-nums whitespace-nowrap",
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
  const thin = isLowSample(item.stats.total, positionTotal);
  return (
    <tr
      id={id}
      onClick={onPlay}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      aria-selected={active}
      className={cn("relative isolate h-8 cursor-pointer transition-colors hover:bg-specimen/60 [&>td]:border-b [&>td]:border-rule", active && "[&>td]:border-transparent")}
    >
      <td className={COL.move} title={openingName ?? undefined}>
        {active && (
          <>
            {/* marker wash across the row (the tr is the containing block) and a pencil tick in the margin */}
            <HighlighterWash fill seed={`row-${item.move}`} amp={1.4} />
            <PencilTick seed={item.move} className="absolute top-1/2 left-[2px] -translate-y-1/2" />
          </>
        )}
        <div className={cn("flex min-w-0 items-baseline gap-2 text-ink", dim && "text-pencil/70")}>
          <span className="shrink-0 font-mono text-sm font-semibold">{item.move}</span>
          {openingName && <span className="hidden min-w-0 truncate font-serif text-xs text-muted-foreground italic @md:inline">{openingName}</span>}
        </div>
      </td>
      <td className={cn(COL.games, "text-[13px]", dim && "text-pencil/70")}>{compact(item.stats.total)}</td>
      <td className={cn(COL.share, "text-xs text-muted-foreground")}>{shareLabel(item.stats.total, positionTotal)}</td>
      <td className={cn(COL.bar, thin ? "opacity-55" : dim && "opacity-75")}>
        <WdbBar stats={item.stats} side={side} seed={item.move} />
      </td>
      <td
        className={cn(COL.score, "text-[13px] font-semibold", scoreTextClass(sc, item.stats.total), thin && "opacity-55")}
        title={thin ? "Small sample" : undefined}
        aria-description={thin ? "small sample" : undefined}
      >
        {pct(sc)}
      </td>
    </tr>
  );
}
