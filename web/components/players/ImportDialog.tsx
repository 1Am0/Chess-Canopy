"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImportForm } from "@/components/players/ImportForm";
import { useExplorerStore } from "@/lib/store";

export function ImportDialog() {
  const open = useExplorerStore((s) => s.importOpen);
  const setUi = useExplorerStore((s) => s.setUi);
  return (
    <Dialog open={open} onOpenChange={(o) => setUi({ importOpen: o })}>
      <DialogContent>
        <DialogHeader kicker="Accession">
          <DialogTitle>Import games</DialogTitle>
          <DialogDescription>Games are stored only in this browser. Nothing is uploaded anywhere.</DialogDescription>
        </DialogHeader>
        <ImportForm idPrefix="dlg" onDone={() => setUi({ importOpen: false })} />
      </DialogContent>
    </Dialog>
  );
}
