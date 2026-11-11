import { Loader2 } from "lucide-react";
import type { ImportProgress as Progress } from "@/lib/engine/types";
import { Button } from "@/components/ui/button";
import { progressSummary } from "@/components/players/progress-summary";

/**
 * Import progress as a tailor's measuring tape: a manila strip printed with ticks and numbers, with the ink-green
 * length pulled out along it. Same progressbar role and values as before; indeterminate = a short pulsing length.
 */
export function ImportProgress({ progress, onCancel }: { progress: Progress; onCancel: () => void }) {
  const { label, detail, pct } = progressSummary(progress);
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {label}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
      <div
        className="relative h-8 overflow-hidden border border-[var(--tag-edge)] bg-[var(--tag)] shadow-[inset_0_1px_2px_var(--btn-drop),0.5px_1px_1px_var(--btn-drop)] forced-colors:border-[GrayText]"
        style={{ backgroundImage: "var(--sheet-tile)" }}
        role="progressbar"
        aria-label="Import progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
      >
        {/* the length of tape pulled out so far */}
        <div
          className={`absolute inset-y-0 left-0 border-r-2 border-[var(--tag-ink)] bg-primary/55 transition-[width] forced-colors:bg-[Highlight] ${pct == null ? "w-1/3 animate-pulse motion-reduce:animate-none" : ""}`}
          style={pct != null ? { width: `${pct}%` } : undefined}
        />
        <span aria-hidden="true" className="ticks absolute inset-x-0 bottom-0 block h-3 [--tick-color:var(--tag-ink)] [--tick-gap:2%]" />
        <div aria-hidden="true" className="absolute inset-x-1 top-0.5 flex justify-between font-mono text-[10px] leading-3 text-[var(--tag-ink)] tabular-nums">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100%</span>
        </div>
      </div>
      <p className="font-mono text-xs text-muted-foreground tabular-nums">{detail}</p>
    </div>
  );
}
