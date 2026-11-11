"use client";

import { useState } from "react";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Player } from "@/lib/engine/types";
import { getExplorer } from "@/lib/explorer-client";
import { refreshPlayers } from "@/hooks/use-explorer-sync";
import { useExplorerStore } from "@/lib/store";
import { sourceLabel } from "@/lib/format";
import { useSharedImport } from "@/components/players/ImportProvider";
import { ImportProgress } from "@/components/players/ImportProgress";
import { EmptyState, MetaGrid } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PlayerManager() {
  const open = useExplorerStore((s) => s.managerOpen);
  const players = useExplorerStore((s) => s.players);
  const setUi = useExplorerStore((s) => s.setUi);
  const { progress, running, sync, cancel } = useSharedImport();
  const [confirming, setConfirming] = useState<string | null>(null);

  const exportPlayer = async (p: Player) => {
    try {
      const text = await getExplorer().exportPlayer(p.id);
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${p.source}-${p.username}.json`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke after the browser has started the download.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const remove = async (p: Player) => {
    try {
      await getExplorer().deletePlayer(p.id);
      const st = useExplorerStore.getState();
      if (st.selected !== "all") st.setSelected(st.selected.filter((id) => id !== p.id));
      await refreshPlayers();
      toast.success(`${p.displayName} deleted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setConfirming(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => setUi({ managerOpen: o })}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage players</DialogTitle>
          <DialogDescription>Download a player&rsquo;s games as a JSON file.</DialogDescription>
        </DialogHeader>
        <ul className="-mx-1 max-h-[60vh] space-y-4 overflow-y-auto px-1 pt-1 pb-2">
          {players.length === 0 && (
            <li>
              <EmptyState title="No players yet" hint="Import games to add one." />
            </li>
          )}
          {players.map((p) => (
            <li key={p.id}>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="block truncate text-base leading-tight font-semibold">{p.displayName}</span>
                </div>
                <span className="shrink-0 rounded-sm border border-border bg-secondary px-1.5 text-xs leading-5 text-muted-foreground">{sourceLabel(p.source)}</span>
              </div>
              <MetaGrid
                className="mt-2"
                items={[
                  { label: "Games", value: p.gameCount.toLocaleString() },
                  { label: "Last sync", value: p.lastSyncedAt ? new Date(p.lastSyncedAt).toLocaleDateString() : "Never" },
                ]}
              />
              {confirming === p.id ? (
                <div className="mt-3 flex items-center gap-2">
                  <p className="min-w-0 text-sm">Delete {p.displayName} and all their games?</p>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
                    <Button size="sm" variant="destructive" disabled={running} onClick={() => remove(p)}>Delete</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {(p.source === "chess.com" || p.source === "lichess") && (
                    <Button size="xs" variant="outline" disabled={running} onClick={() => sync(p.id)} aria-label={`Sync ${p.displayName}`} title="Sync new games">
                      <RefreshCw /> Sync
                    </Button>
                  )}
                  <Button size="xs" variant="outline" onClick={() => exportPlayer(p)} aria-label={`Export ${p.displayName} as JSON`} title="Export JSON">
                    <Download /> Export JSON
                  </Button>
                  <Button size="xs" variant="outline" className="ml-auto" disabled={running} onClick={() => setConfirming(p.id)} aria-label={`Delete ${p.displayName}`} title={running ? "Wait for the import to finish" : "Delete"}>
                    <Trash2 /> Delete
                  </Button>
                </div>
              )}
            </div>
            </li>
          ))}
        </ul>
        {progress && <ImportProgress progress={progress} onCancel={cancel} />}
        <Button variant="outline" disabled={running} onClick={() => setUi({ managerOpen: false, importOpen: true })}>Import another player</Button>
      </DialogContent>
    </Dialog>
  );
}
