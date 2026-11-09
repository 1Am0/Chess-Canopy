"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { ImportOutcome, ImportProgress, ImportRequest } from "@/lib/engine/types";
import { getExplorer, withProxy } from "@/lib/explorer-client";
import { refreshPlayers } from "@/hooks/use-explorer-sync";
import { useExplorerStore } from "@/lib/store";

export function useImport() {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);

  const finish = useCallback(async (outcome: ImportOutcome) => {
    await refreshPlayers();
    const st = useExplorerStore.getState();
    // Make sure the freshly imported player is part of the selection.
    if (st.selected !== "all" && !st.selected.includes(outcome.playerId)) {
      st.setSelected([...st.selected, outcome.playerId]);
    }
    st.bumpSelection();
    toast.success(
      outcome.added > 0
        ? `Imported ${outcome.added.toLocaleString()} new games (${outcome.total.toLocaleString()} total)`
        : "Already up to date: no new games",
    );
  }, []);

  const run = useCallback(
    async (op: (onProgress: (p: ImportProgress) => void) => Promise<ImportOutcome>): Promise<ImportOutcome | null> => {
      cancelled.current = false;
      setRunning(true);
      setProgress({ phase: "fetching", done: 0, total: null, added: 0, duplicates: 0 });
      try {
        const outcome = await op(withProxy((p: ImportProgress) => setProgress(p)));
        await finish(outcome);
        return outcome;
      } catch (e) {
        if (cancelled.current) toast("Import cancelled");
        else toast.error(e instanceof Error ? e.message : "Import failed");
        return null;
      } finally {
        setRunning(false);
        setProgress(null);
      }
    },
    [finish],
  );

  const start = useCallback((req: ImportRequest) => run((cb) => getExplorer().importGames(req, cb)), [run]);
  const sync = useCallback((id: string) => run((cb) => getExplorer().syncPlayer(id, cb)), [run]);
  const cancel = useCallback(() => {
    cancelled.current = true;
    void getExplorer().cancelImport();
  }, []);

  return { progress, running, start, sync, cancel };
}
