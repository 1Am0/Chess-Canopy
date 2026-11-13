"use client";

import { useState } from "react";
import { Download, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Player } from "@/lib/engine/types";
import { getExplorer } from "@/lib/explorer-client";
import { refreshPlayers } from "@/hooks/use-explorer-sync";
import { useExplorerStore } from "@/lib/store";
import { sourceLabel } from "@/lib/format";
import { useSharedImport } from "@/components/players/ImportProvider";
import { ImportProgress } from "@/components/players/ImportProgress";
import { EmptySpecimen, MetaGrid } from "@/components/field";
import { PaperLabel, PaperSheet, RubberStamp } from "@/components/paper";
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
        <DialogHeader kicker="Collection register">
          <DialogTitle className="font-serif text-xl font-semibold tracking-tight">Manage players</DialogTitle>
          <DialogDescription>All data stays in your browser. Export a player as schema v1 JSON for the Python CLI.</DialogDescription>
        </DialogHeader>
        <ul className="-mx-1 max-h-[60vh] space-y-4 overflow-y-auto px-1 pt-1 pb-2">
          {players.length === 0 && (
            <li>
              <EmptySpecimen title="No players yet" hint="No players imported yet." />
            </li>
          )}
          {players.map((p, i) => (
            <li key={p.id}>
            <PaperSheet className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="kicker mb-0 tabular-nums">No. {String(i + 1).padStart(3, "0")}</p>
                  <span className="block truncate font-serif text-lg leading-tight font-semibold italic">{p.displayName}</span>
                </div>
                <PaperLabel tone="manila" taped rotate={i % 2 ? 1 : -1} className="mt-1 mr-1">{sourceLabel(p.source)}</PaperLabel>
              </div>
              <span aria-hidden className="mt-2 block h-px bg-margin" />
              <MetaGrid
                className="mt-2"
                items={[
                  { label: "Games", value: p.gameCount.toLocaleString() },
                  { label: "Last sync", value: p.lastSyncedAt ? new Date(p.lastSyncedAt).toLocaleDateString() : "Never" },
                ]}
              />
              {confirming === p.id ? (
                <div className="mt-3 flex items-center gap-2">
                  <RubberStamp tone="destructive" seed={p.id}>Delete {p.displayName}?</RubberStamp>
                  <div className="ml-auto flex items-center gap-1">
                    <Button size="sm" variant="destructive" disabled={running} onClick={() => remove(p)}>Delete</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Keep</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {(p.source === "chess.com" || p.source === "lichess") && (
                    <Button size="xs" variant="tag" disabled={running} onClick={() => sync(p.id)} aria-label={`Sync ${p.displayName}`} title="Sync new games">
                      <RefreshCw /> Sync
                    </Button>
                  )}
                  <Button size="xs" variant="tag" onClick={() => exportPlayer(p)} aria-label={`Export ${p.displayName} as JSON`} title="Export JSON">
                    <Download /> Export JSON
                  </Button>
                  {/* set apart from the safe actions: a quiet red text button at the far end, behind a confirmation */}
                  <span aria-hidden className="mx-1 ml-auto h-4 w-px bg-rule-strong/60" />
                  <Button size="xs" variant="ghost" className="text-destructive hover:text-destructive" disabled={running} onClick={() => setConfirming(p.id)} aria-label={`Delete ${p.displayName}`} title={running ? "Wait for the import to finish" : "Delete"}>
                    <Trash2 /> Delete
                  </Button>
                </div>
              )}
            </PaperSheet>
            </li>
          ))}
        </ul>
        {progress && <ImportProgress progress={progress} onCancel={cancel} />}
        <Button disabled={running} onClick={() => setUi({ managerOpen: false, importOpen: true })}>
          <Plus /> Import another player
        </Button>
      </DialogContent>
    </Dialog>
  );
}
