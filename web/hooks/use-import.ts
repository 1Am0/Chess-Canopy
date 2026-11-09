"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { ImportOutcome, ImportProgress, ImportRequest } from "@/lib/engine/types";
import { getExplorer } from "@/lib/explorer-client";
import { refreshPlayers } from "@/hooks/use-explorer-sync";
import { playSound } from "@/lib/sound";
import { effectiveSelection, useExplorerStore } from "@/lib/store";

export function useImport() {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);

  const finish = useCallback(async (outcome: ImportOutcome) => {
    await refreshPlayers();
    const st = useExplorerStore.getState();
    // Make sure the freshly imported player(s) are part of the selection.
    const eff = effectiveSelection(st.selected, st.players);
    const ids = outcome.playerIds?.length ? outcome.playerIds : [outcome.playerId];
    if (eff === "all") {
      if (st.selected !== "all") st.setSelected("all"); // drop stale ids
    } else if (ids.some((id) => !eff.includes(id))) {
      st.setSelected([...eff, ...ids.filter((id) => !eff.includes(id))]);
    } else if (eff.length !== st.selected.length) {
      st.setSelected(eff);
    }
    // players changed, so useExplorerSync re-applies the selection and re-queries.
    const skipped = outcome.skipped
      ? ` · skipped ${outcome.skipped.toLocaleString()} non-standard game${outcome.skipped === 1 ? "" : "s"}`
      : "";
    playSound("done");
    toast.success(
      outcome.added > 0
        ? `Imported ${outcome.added.toLocaleString()} new games (${outcome.total.toLocaleString()} total)${skipped}`
        : `Already up to date: no new games${skipped}`,
    );
  }, []);

  const run = useCallback(
    async (op: (onProgress: (p: ImportProgress) => void) => Promise<ImportOutcome>): Promise<ImportOutcome | null> => {
      cancelled.current = false;
      setRunning(true);
      setProgress({ phase: "fetching", done: 0, total: null, added: 0, duplicates: 0 });
      try {
        const outcome = await op((p: ImportProgress) => setProgress(p));
        await finish(outcome);
        return outcome;
      } catch (e) {
        const aborted = cancelled.current || (e instanceof Error && e.name === "AbortError");
        // A cancelled import may still have saved a partial batch (lichess).
        if (aborted) {
          toast("Import cancelled");
          await refreshPlayers().catch(() => {});
        } else toast.error(e instanceof Error && e.message ? e.message : "Import failed");
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
