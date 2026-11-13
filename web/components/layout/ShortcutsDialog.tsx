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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader kicker="Key to symbols">
          <DialogTitle className="font-serif text-xl font-semibold tracking-tight">Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts are paused while typing or when a dialog is open.</DialogDescription>
        </DialogHeader>
        <dl className="border-t border-rule-strong text-[15px]">
          {SHORTCUTS.map(([keys, d]) => (
            <div key={d} className="flex min-h-11 items-center gap-4 border-b border-rule py-2">
              <dt className="flex w-40 shrink-0 flex-wrap gap-1.5">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="paper-label inline-flex min-w-8 items-center justify-center rounded-[2px] border-b-2 border-b-[var(--btn-edge)] px-2 py-1 text-center font-mono text-[13px] font-medium text-foreground"
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
