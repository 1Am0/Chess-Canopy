"use client";

import { X } from "lucide-react";
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
    <div role="status" aria-live="polite" data-testid="import-indicator" className="flex h-9 items-center rounded-md border border-input bg-card text-xs tabular-nums sm:h-8">
      <button
        type="button"
        onClick={() => setUi({ importOpen: true })}
        aria-label={`Importing: ${label}. Show details`}
        className="flex h-full items-center gap-1.5 relative rounded-l-sm px-2 outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
      >
        <span className="tabular-nums">{pct != null ? `${pct}%` : <span className="hidden sm:inline">Importing</span>}</span>
        {pct != null && <span className="hidden sm:inline">Importing</span>}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-border">
          <span className={`block h-full bg-primary ${pct == null ? "w-1/3" : ""}`} style={pct != null ? { width: `${pct}%` } : undefined} />
        </span>
      </button>
      <Button type="button" variant="ghost" size="icon" className="size-9 min-w-6 sm:size-8 rounded-l-none border-l border-border" onClick={cancel} aria-label="Cancel import">
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
