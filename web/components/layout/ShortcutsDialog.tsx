"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useExplorerStore } from "@/lib/store";

// Each entry: the keycaps (typed on little paper labels) and what they do.
const SHORTCUTS: [string[], string][] = [
  [["←"], "Previous move"],
  [["→"], "Next move (redo)"],
  [["↑"], "Jump to start"],
  [["↓"], "Jump to end"],
  [["F"], "Flip board"],
  [["Esc"], "Clear move preview"],
  [["?"], "Show this help"],
  [["Tab", "↑ ↓", "Enter"], "Tab to the move table, then ↑ ↓ and Enter select and play a candidate move"],
];

export function ShortcutsDialog() {
  const open = useExplorerStore((s) => s.shortcutsOpen);
  const setUi = useExplorerStore((s) => s.setUi);
  return (
    <Dialog open={open} onOpenChange={(o) => setUi({ shortcutsOpen: o })}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts are paused while typing or when a dialog is open.</DialogDescription>
        </DialogHeader>
        <dl className="border-t border-border text-sm">
          {SHORTCUTS.map(([keys, d]) => (
            <div key={d} className="flex min-h-10 items-center gap-3 border-b border-border py-1.5">
              <dt className="flex w-28 shrink-0 flex-wrap gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex min-w-7 items-center justify-center rounded-sm border border-border border-b-2 bg-secondary px-1.5 py-0.5 text-center font-mono text-xs font-medium text-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="min-w-0 flex-1 leading-snug">{d}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
