"use client";

import { Loader2, X } from "lucide-react";
import { useExplorerStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useSharedImport } from "@/components/players/ImportProvider";
import { progressSummary } from "@/components/players/progress-summary";

/**
 * Compact header chip shown while an import runs and its dialog is closed: progress plus
 * Cancel. Clicking the chip reopens the import dialog.
 */
export function ImportIndicator() {
  const { running, progress, cancel } = useSharedImport();
  const importOpen = useExplorerStore((s) => s.importOpen);
  const managerOpen = useExplorerStore((s) => s.managerOpen);
  const setUi = useExplorerStore((s) => s.setUi);
  if (!running || importOpen || managerOpen) return null;
  const { label, pct } = progressSummary(progress);
  return (
    <div role="status" aria-live="polite" data-testid="import-indicator" className="flex h-8 items-center rounded-md border bg-muted/40 text-xs">
      <button
        type="button"
        onClick={() => setUi({ importOpen: true })}
        aria-label={`Importing: ${label}. Show details`}
        className="flex h-full items-center gap-1.5 rounded-l-md px-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <Loader2 className="size-3.5 animate-spin" />
        <span className="tabular-nums">{pct != null ? `${pct}%` : <span className="hidden sm:inline">Importing</span>}</span>
        {pct != null && <span className="hidden sm:inline">Importing</span>}
      </button>
      <Button type="button" variant="ghost" size="icon" className="size-8 min-w-6 rounded-l-none" onClick={cancel} aria-label="Cancel import">
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
