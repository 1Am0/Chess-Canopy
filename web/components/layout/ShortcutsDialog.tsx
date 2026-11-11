"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useExplorerStore } from "@/lib/store";

const SHORTCUTS: [string, string][] = [
  ["←", "Previous move"],
  ["→", "Next move (redo)"],
  ["↑", "Jump to start"],
  ["↓", "Jump to end"],
  ["F", "Flip board"],
  ["Esc", "Clear move preview"],
  ["?", "Show this help"],
  ["Tab to move table, then ↑ ↓ / Enter", "Select and play a candidate move"],
];

export function ShortcutsDialog() {
  const open = useExplorerStore((s) => s.shortcutsOpen);
  const setUi = useExplorerStore((s) => s.setUi);
  return (
    <Dialog open={open} onOpenChange={(o) => setUi({ shortcutsOpen: o })}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-semibold tracking-tight">Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts are paused while typing or when a dialog is open.</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-rule border-y border-rule text-sm">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-2">
              <dd className="order-2 text-right text-muted-foreground">{d}</dd>
              <dt className="order-1">
                <kbd className="inline-flex min-w-6 items-center justify-center rounded-sm border border-b-2 border-rule-strong bg-specimen px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
              </dt>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
