import { VERDICT_LABEL, type MoveEval } from "@/lib/repertoire/types";
import { formatEval } from "@/lib/cloud-eval";
import { scoreChipColor } from "@/components/explorer/wdb";
import { cn } from "@/lib/utils";
import { lossLabel } from "@/components/repertoire/format";

/** The score chip's red / sand / green scale, read as a verdict: fine is green, dubious sand, a mistake red. */
const TONE = { good: scoreChipColor(0.75), dubious: scoreChipColor(0.5), bad: scoreChipColor(0.25) } as const;

/** The engine's verdict on one move, as a small score-chip ("Fine", "Dubious", "Mistake"); nothing until it is known. */
export function VerdictChip({ ev, className }: { ev: MoveEval | undefined; className?: string }) {
  if (!ev) return null;
  if (ev.verdict === "unknown") {
    return <span className={cn("text-xs text-muted-foreground", className)}>{VERDICT_LABEL.unknown}</span>;
  }
  const detail = [ev.lossCp != null && ev.lossCp > 0 ? `loses ${lossLabel(ev.lossCp)}` : null, ev.after ? `eval after ${formatEval(ev.after)}` : null]
    .filter(Boolean)
    .join(", ");
  return (
    <span
      className={cn("score-chip min-w-0 text-[11px] whitespace-nowrap", className)}
      style={{ backgroundColor: TONE[ev.verdict] }}
      title={detail ? `${VERDICT_LABEL[ev.verdict]}: ${detail}` : VERDICT_LABEL[ev.verdict]}
    >
      {VERDICT_LABEL[ev.verdict]}
    </span>
  );
}
