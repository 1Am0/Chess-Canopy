"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Color, SelectionSummary } from "@/lib/engine/types";
import { getExplorer, isExplorerRestart, onExplorerRestart } from "@/lib/explorer-client";
import { activeFilterCount, effectiveSelection, selectionFilters, useExplorerStore } from "@/lib/store";
import { usePosition, validateLine } from "@/hooks/use-position";

/**
 * Parse `?line=`: URLSearchParams turns a raw "+" into a space ("Bxf7+" -> "Bxf7 "), so
 * spaces are mapped back before splitting; the legal prefix is kept as chess.js SAN.
 */
export function parseLineParam(raw: string | null): string[] {
  if (!raw) return [];
  return validateLine(raw.replace(/ /g, "+").split(",").map((m) => m.trim()).filter(Boolean));
}

/**
 * Side to view after a selection summary, or null to keep the current one.
 * - Until the user picks a side: the side with more games (also when the current side has 0).
 * - Afterwards: only when the current side has no games at all, the other side has some, and
 *   no filter is active (so the player simply never played that color).
 */
export function autoSide(
  summary: SelectionSummary,
  cur: Color,
  sideChosen: boolean,
  filterCount: number,
): Color | null {
  const other: Color = cur === "white" ? "black" : "white";
  if (summary.counts.white + summary.counts.black === 0) return null;
  if (!sideChosen) return summary.counts[other] > summary.counts[cur] ? other : null;
  if (summary.counts[cur] === 0 && summary.counts[other] > 0 && filterCount === 0) return other;
  return null;
}

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
  /** Latest setSelection request; older responses are ignored. */
  const selReq = useRef(0);
  /** A selection change is pending (debounce or in flight): position queries wait for it. */
  const selPending = useRef(false);
  /** Bumped when the worker crashed and was restarted, to re-apply the selection. */
  const [restarts, setRestarts] = useState(0);

  useEffect(
    () =>
      onExplorerRestart(() => {
        toast.error("The explorer stopped unexpectedly and was restarted.");
        setRestarts((n) => n + 1);
      }),
    [],
  );

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
        const params = new URLSearchParams(window.location.search);
        const line = parseLineParam(params.get("line"));
        if (line.length) useExplorerStore.getState().setLine(line);
        const side = params.get("side");
        if (side === "white" || side === "black") useExplorerStore.getState().setSide(side);
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
    const req = ++selReq.current;
    if (players.length === 0) {
      selPending.current = false;
      st.setResult(null);
      st.setSummary(null);
      st.setResultLoading(false);
      return;
    }
    selPending.current = true;
    st.setResultLoading(true);
    const t = setTimeout(async () => {
      try {
        const summary = await getExplorer().setSelection(effectiveSelection(selected, players), selectionFilters(filters));
        if (req !== selReq.current) return; // a newer selection is on its way
        selPending.current = false;
        const s = useExplorerStore.getState();
        s.setSummary(summary);
        const cur = s.filters.color ?? "white";
        const pick = autoSide(summary, cur, s.sideChosen, activeFilterCount(s.filters));
        if (pick) {
          // Changes filters.color, which re-runs this effect; the query follows that selection.
          s.autoPickSide(pick);
          return;
        }
        if (!s.sideChosen && summary.counts.white + summary.counts.black > 0) useExplorerStore.setState({ sideChosen: true });
        s.bumpSelection();
      } catch (e) {
        if (req !== selReq.current) return;
        selPending.current = false;
        useExplorerStore.getState().setResultLoading(false);
        if (isExplorerRestart(e)) return; // re-applied after the restart
        toast.error(`Could not apply filters: ${e instanceof Error ? e.message : String(e)}`);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [ready, players, selected, filters, restarts]);

  // Query the current position.
  useEffect(() => {
    if (!ready || selectionVersion === 0) return;
    const id = ++queryId.current;
    const st = useExplorerStore.getState();
    st.setResultLoading(true);
    // A move during a filter change: the pending selection queries the latest position when
    // it lands, so don't also query the old selection (stale counts, a second tree walk).
    if (selPending.current) return;
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
        if (isExplorerRestart(e)) return; // re-applied after the restart
        if (e instanceof Error && e.message.includes("Invalid move sequence")) {
          // Keep the legal prefix rather than wiping the whole line.
          const s = useExplorerStore.getState();
          const legal = validateLine(s.path);
          if (legal.length !== s.path.length || legal.some((m, i) => m !== s.path[i])) {
            useExplorerStore.setState({ path: legal, cursor: Math.min(s.cursor, legal.length), hoverMove: null });
          }
          return;
        }
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
