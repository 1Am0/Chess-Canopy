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
    <div role="status" aria-live="polite" data-testid="import-indicator" className="paper-label flex h-8 items-center rounded-[2px] font-mono text-xs">
      <button
        type="button"
        onClick={() => setUi({ importOpen: true })}
        aria-label={`Importing: ${label}. Show details`}
        className="flex h-full items-center gap-1.5 relative rounded-l-sm px-2 outline-none hover:bg-[var(--sheet-under)]/60 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <span className="tabular-nums">{pct != null ? `${pct}%` : <span className="hidden sm:inline">Importing</span>}</span>
        {pct != null && <span className="hidden uppercase tracking-wider sm:inline">Importing</span>}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-rule">
          <span className={`block h-full bg-primary ${pct == null ? "w-1/3 animate-pulse motion-reduce:animate-none" : ""}`} style={pct != null ? { width: `${pct}%` } : undefined} />
        </span>
      </button>
      <Button type="button" variant="ghost" size="icon" className="size-8 min-w-6 rounded-l-none border-l border-rule" onClick={cancel} aria-label="Cancel import">
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
