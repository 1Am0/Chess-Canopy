import type { ImportProgress as Progress } from "@/lib/engine/types";
import { Button } from "@/components/ui/button";
import { progressSummary } from "@/components/players/progress-summary";

/** Import progress: a label, a thin determinate bar (a short pulsing segment when indeterminate) and the detail line. */
export function ImportProgress({ progress, onCancel }: { progress: Progress; onCancel: () => void }) {
  const { label, detail, pct } = progressSummary(progress);
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-sm border border-border bg-secondary forced-colors:border-[GrayText]"
        role="progressbar"
        aria-label="Import progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
      >
        <div
          className={`absolute inset-y-0 left-0 bg-primary transition-[width] motion-reduce:transition-none forced-colors:bg-[Highlight] ${pct == null ? "w-1/3" : ""}`}
          style={pct != null ? { width: `${pct}%` } : undefined}
        />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">{detail}</p>
    </div>
  );
}
