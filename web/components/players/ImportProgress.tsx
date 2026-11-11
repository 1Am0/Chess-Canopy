import { Loader2 } from "lucide-react";
import type { ImportProgress as Progress } from "@/lib/engine/types";
import { Button } from "@/components/ui/button";
import { progressSummary } from "@/components/players/progress-summary";

export function ImportProgress({ progress, onCancel }: { progress: Progress; onCancel: () => void }) {
  const { label, detail, pct } = progressSummary(progress);
  return (
    <div className="space-y-2 border-y border-rule py-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Loader2 className="size-4 animate-spin" />
          {label}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      <div
        className="h-0.5 w-full overflow-hidden bg-rule"
        role="progressbar"
        aria-label="Import progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
      >
        <div
          className={`h-full bg-primary transition-[width] ${pct == null ? "w-1/3 animate-pulse" : ""}`}
          style={pct != null ? { width: `${pct}%` } : undefined}
        />
      </div>
      <p className="font-mono text-xs text-muted-foreground tabular-nums">{detail}</p>
    </div>
  );
}
