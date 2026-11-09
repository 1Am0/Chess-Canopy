"use client";

import { useState } from "react";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Player } from "@/lib/engine/types";
import { getExplorer } from "@/lib/explorer-client";
import { refreshPlayers } from "@/hooks/use-explorer-sync";
import { useImport } from "@/hooks/use-import";
import { useExplorerStore } from "@/lib/store";
import { sourceLabel } from "@/lib/format";
import { ImportProgress } from "@/components/players/ImportProgress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PlayerManager() {
  const open = useExplorerStore((s) => s.managerOpen);
  const players = useExplorerStore((s) => s.players);
  const setUi = useExplorerStore((s) => s.setUi);
  const { progress, running, sync, cancel } = useImport();
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
      toast.success(`Deleted ${p.displayName}`);
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
          <DialogDescription>All data stays in your browser. Export a player as schema v1 JSON for the Python CLI.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-lg border">
          {players.length === 0 && <li className="p-4 text-sm text-muted-foreground">No players imported yet.</li>}
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{p.displayName}</span>
                  <Badge variant="outline" className="text-[10px]">{sourceLabel(p.source)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {p.gameCount.toLocaleString()} games
                  {p.lastSyncedAt ? ` · synced ${new Date(p.lastSyncedAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              {confirming === p.id ? (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="destructive" onClick={() => remove(p)}>Delete</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Keep</Button>
                </div>
              ) : (
                <div className="flex items-center">
                  {(p.source === "chess.com" || p.source === "lichess") && (
                    <Button size="icon" variant="ghost" disabled={running} onClick={() => sync(p.id)} aria-label={`Sync ${p.displayName}`} title="Sync new games">
                      <RefreshCw />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => exportPlayer(p)} aria-label={`Export ${p.displayName} as JSON`} title="Export JSON">
                    <Download />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setConfirming(p.id)} aria-label={`Delete ${p.displayName}`} title="Delete">
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {progress && <ImportProgress progress={progress} onCancel={cancel} />}
        <Button variant="outline" onClick={() => setUi({ managerOpen: false, importOpen: true })}>Import another player</Button>
      </DialogContent>
    </Dialog>
  );
}
