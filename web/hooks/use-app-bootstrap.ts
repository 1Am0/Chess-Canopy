"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { onDataChanged } from "@/lib/cross-tab";
import { getExplorer } from "@/lib/explorer-client";
import { useExplorerStore } from "@/lib/store";
import { refreshPlayers } from "@/hooks/use-explorer-sync";
import { useRepertoirePage } from "@/lib/repertoire/page-store";

/**
 * Bootstrap for pages other than the explorer (the Repertoire page): rehydrate the shared settings, take the side from
 * `?side=`, load the players and mark the store ready. Keeps the players fresh when another tab changes the data, and
 * picks up settings changed in another tab. No position queries and no `?line=` handling (that is the explorer's).
 * Render <UrlSideSync/> next to it to keep the side in the address bar.
 */
export function useAppBootstrap() {
  // Another tab imported, synced or deleted: drop this tab's cached games and reload the players.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onDataChanged(() => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          await getExplorer().invalidate?.();
          await refreshPlayers();
        } catch {
          /* the next user action reports real problems */
        }
      }, 150);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);

  // Settings changed in another tab: pick them up.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!useExplorerStore.getState().ready) return;
      if (e.key === null || e.key === "chess-canopy:v1") void Promise.resolve(useExplorerStore.persist.rehydrate()).catch(() => {});
      if (e.key === null || e.key === "chess-canopy:repertoire:v1") void Promise.resolve(useRepertoirePage.persist.rehydrate()).catch(() => {});
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Bootstrap once on the client.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await useExplorerStore.persist.rehydrate();
      } catch {
        /* ignore corrupt storage */
      }
      try {
        await useRepertoirePage.persist.rehydrate();
      } catch {
        /* ignore corrupt storage */
      }
      try {
        const side = new URLSearchParams(window.location.search).get("side");
        if (side === "white" || side === "black") useExplorerStore.getState().setSide(side, false);
      } catch {
        /* ignore */
      }
      try {
        await refreshPlayers();
      } catch (e) {
        toast.error(`Could not load players: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (!cancelled) useExplorerStore.getState().setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
