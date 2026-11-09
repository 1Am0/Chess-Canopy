import { Loader2 } from "lucide-react";
import type { ImportProgress as Progress } from "@/lib/engine/types";
import { Button } from "@/components/ui/button";

export function ImportProgress({ progress, onCancel }: { progress: Progress; onCancel: () => void }) {
  const determinate = progress.total != null && progress.total > 0;
  const pct = determinate ? Math.min(100, Math.round((progress.done / (progress.total as number)) * 100)) : null;
  return (
    <div className="space-y-2 rounded-lg border bg-muted/40 p-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Loader2 className="size-4 animate-spin" />
          {progress.message ?? (progress.phase === "parsing" ? "Parsing games…" : progress.phase === "saving" ? "Saving…" : "Fetching games…")}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
      >
        <div
          className={`h-full rounded-full bg-primary transition-[width] ${pct == null ? "w-1/3 animate-pulse" : ""}`}
          style={pct != null ? { width: `${pct}%` } : undefined}
        />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {progress.added.toLocaleString()} new · {progress.duplicates.toLocaleString()} duplicates
        {pct != null ? ` · ${pct}%` : ""}
      </p>
    </div>
  );
}
