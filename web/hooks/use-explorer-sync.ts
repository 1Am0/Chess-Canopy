"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getExplorer } from "@/lib/explorer-client";
import { effectiveSelection, useExplorerStore } from "@/lib/store";
import { usePosition, validateLine } from "@/hooks/use-position";

export async function refreshPlayers() {
  const players = await getExplorer().listPlayers();
  useExplorerStore.getState().setPlayers(players);
  return players;
}

/** Bootstraps the store (rehydrate, players, URL line) and keeps query results fresh. */
export function useExplorerSync() {
  const ready = useExplorerStore((s) => s.ready);
  const players = useExplorerStore((s) => s.players);
  const selected = useExplorerStore((s) => s.selected);
  const filters = useExplorerStore((s) => s.filters);
  const selectionVersion = useExplorerStore((s) => s.selectionVersion);
  const { key, visible } = usePosition();
  const urlRead = useRef(false);
  const queryId = useRef(0);

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
        const line = new URLSearchParams(window.location.search).get("line");
        if (line) useExplorerStore.getState().setLine(validateLine(line.split(",").filter(Boolean)));
      } catch {
        /* ignore */
      }
      urlRead.current = true;
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

  // Write the line into the URL (replaceState) once the initial read happened.
  useEffect(() => {
    if (!ready || !urlRead.current) return;
    try {
      const url = new URL(window.location.href);
      if (visible.length) url.searchParams.set("line", visible.join(","));
      else url.searchParams.delete("line");
      const next = url.pathname + (url.search ? url.search.replace(/%2C/gi, ",") : "") + url.hash;
      window.history.replaceState(null, "", next);
    } catch {
      /* ignore */
    }
  }, [ready, key, visible]);

  // Apply selection + filters (debounced).
  useEffect(() => {
    if (!ready) return;
    const st = useExplorerStore.getState();
    if (players.length === 0) {
      st.setResult(null);
      st.setSummary(null);
      st.setResultLoading(false);
      return;
    }
    st.setResultLoading(true);
    const t = setTimeout(async () => {
      try {
        const summary = await getExplorer().setSelection(effectiveSelection(selected, players), filters);
        const s = useExplorerStore.getState();
        s.setSummary(summary);
        s.bumpSelection();
      } catch (e) {
        toast.error(`Could not apply filters: ${e instanceof Error ? e.message : String(e)}`);
        useExplorerStore.getState().setResultLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [ready, players, selected, filters]);

  // Query the current position.
  useEffect(() => {
    if (!ready || selectionVersion === 0) return;
    const id = ++queryId.current;
    const st = useExplorerStore.getState();
    st.setResultLoading(true);
    getExplorer()
      .query(visible)
      .then((r) => {
        if (id !== queryId.current) return;
        const s = useExplorerStore.getState();
        s.setResult(r);
        s.setResultLoading(false);
      })
      .catch((e) => {
        if (id !== queryId.current) return;
        useExplorerStore.getState().setResultLoading(false);
        toast.error(`Query failed: ${e instanceof Error ? e.message : String(e)}`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectionVersion, key]);
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable) return;
      }
      // Don't steer the board while a dialog / sheet / popover is open.
      if (document.querySelector('[role="dialog"]')) return;
      const st = useExplorerStore.getState();
      const local = !!t?.closest("[data-local-keys]");
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          st.undo();
          break;
        case "ArrowRight":
          e.preventDefault();
          st.redo();
          break;
        case "ArrowUp":
          if (local) return;
          e.preventDefault();
          st.toStart();
          break;
        case "ArrowDown":
          if (local) return;
          e.preventDefault();
          st.toEnd();
          break;
        case "f":
        case "F":
          e.preventDefault();
          st.flip();
          break;
        case "Escape":
          st.setHoverMove(null);
          break;
        case "?":
          e.preventDefault();
          st.setUi({ shortcutsOpen: true });
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
