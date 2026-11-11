import { Loader2 } from "lucide-react";
import type { ImportProgress as Progress } from "@/lib/engine/types";
import { Button } from "@/components/ui/button";
import { progressSummary } from "@/components/players/progress-summary";

/** Import progress as a measuring tape: primary fill over a ticked scale, mono numbers. */
export function ImportProgress({ progress, onCancel }: { progress: Progress; onCancel: () => void }) {
  const { label, detail, pct } = progressSummary(progress);
  return (
    <div className="space-y-2 border-y border-rule py-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {label}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      <div>
        <div
          className="h-1.5 w-full overflow-hidden border border-rule-strong bg-specimen forced-colors:border-[GrayText]"
          role="progressbar"
          aria-label="Import progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? undefined}
        >
          <div
            className={`h-full bg-primary transition-[width] forced-colors:bg-[Highlight] ${pct == null ? "w-1/3 animate-pulse motion-reduce:animate-none" : ""}`}
            style={pct != null ? { width: `${pct}%` } : undefined}
          />
        </div>
        <span aria-hidden="true" className="ticks block h-2 [--tick-gap:5%]" />
        <div aria-hidden="true" className="mt-0.5 flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
          <span>0</span>
          <span>50</span>
          <span>100%</span>
        </div>
      </div>
      <p className="font-mono text-xs text-muted-foreground tabular-nums">{detail}</p>
    </div>
  );
}
