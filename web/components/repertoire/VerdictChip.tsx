import { VERDICT_LABEL, type MoveEval } from "@/lib/repertoire/types";
import { formatEval } from "@/lib/cloud-eval";
import { scoreChipColor } from "@/components/explorer/wdb";
import { cn } from "@/lib/utils";
import { lossLabel } from "@/components/repertoire/format";

/** The score chip's red / sand / green scale, read as a verdict: fine is green, dubious sand, a mistake red. */
const TONE = { good: scoreChipColor(0.75), dubious: scoreChipColor(0.5), bad: scoreChipColor(0.25) } as const;

/**
 * The engine's evaluation after one move ("+0.3", "-1.2", "M3"; White's point of view, like the eval bar), on a
 * score-chip tinted by the verdict: green fine, sand dubious, red a mistake. Nothing until the engine has looked.
 */
export function VerdictChip({ ev, className }: { ev: MoveEval | undefined; className?: string }) {
  if (!ev) return null;
  if (ev.verdict === "unknown" || !ev.after) {
    return (
      <span className={cn("font-mono text-xs text-muted-foreground", className)} title={VERDICT_LABEL.unknown}>
        <span aria-hidden>–</span>
        <span className="sr-only">{VERDICT_LABEL.unknown}</span>
      </span>
    );
  }
  const text = formatEval(ev.after);
  const detail = `${VERDICT_LABEL[ev.verdict]}${ev.lossCp != null && ev.lossCp > 0 ? `, ${lossLabel(ev.lossCp)} compared with the best move` : ""}`;
  return (
    <span
      className={cn("score-chip min-w-0 font-mono text-[11px] tabular-nums whitespace-nowrap", className)}
      style={{ backgroundColor: TONE[ev.verdict] }}
      title={`Eval ${text} (${detail})`}
      aria-label={`Eval ${text}, ${detail}`}
    >
      {text}
    </span>
  );
}
