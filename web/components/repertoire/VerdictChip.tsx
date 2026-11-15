import { STATUS_HINT, STATUS_LABEL, VERDICT_LABEL, type MoveEval, type PointStatus } from "@/lib/repertoire/types";
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

/** The verdict tones read as a position's status: settled green, undecided or leaking sand, a problem spot red. */
const STATUS_TONE: Record<Exclude<PointStatus, "pending">, string> = {
  settled: TONE.good,
  undecided: TONE.dubious,
  leaking: TONE.dubious,
  problem: TONE.bad,
};

/** A report position's status as a small score-chip (plain muted text while the engine hasn't looked). */
export function StatusChip({ status, className }: { status: PointStatus; className?: string }) {
  if (status === "pending") {
    return (
      <span className={cn("truncate text-xs text-muted-foreground", className)} title={STATUS_HINT.pending}>
        {STATUS_LABEL.pending}
      </span>
    );
  }
  return (
    <span
      className={cn("score-chip min-w-0 truncate text-[11px] whitespace-nowrap", className)}
      style={{ backgroundColor: STATUS_TONE[status] }}
      title={STATUS_HINT[status]}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
