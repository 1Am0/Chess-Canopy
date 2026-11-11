"use client";

import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import type { Color, Filters, Player, QueryResult, SelectionSummary } from "@/lib/engine/types";
import { setSoundsEnabled } from "@/lib/sound";
import { canonicalLine, legalSan, linePositions } from "@/lib/position-cache";


function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Persist storage that skips redundant work. Zustand's `persist` calls `setItem` after
 * every `set()` (hover, cursor steps, results, ...), but `partialize` only picks a few
 * settings. When none of those values changed (by reference) nothing is serialized or
 * written, so hovering rows or holding an arrow key never touches localStorage.
 */
export function createChangeAwareStorage<S extends object>(): PersistStorage<S> {
  let last: { state: S; version?: number } | null = null;
  return {
    getItem: (key) => {
      const raw = readLocal(key);
      if (raw == null) return null;
      try {
        return JSON.parse(raw) as StorageValue<S>;
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      const prev = last;
      if (
        prev &&
        prev.version === value.version &&
        (Object.keys(value.state) as (keyof S)[]).every((k) => Object.is(prev.state[k], value.state[k])) &&
        Object.keys(prev.state).length === Object.keys(value.state).length
      ) {
        return;
      }
      last = { state: value.state, version: value.version };
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        last = null; // storage unavailable: try again next time
      }
    },
    removeItem: (key) => {
      last = null;
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* storage unavailable */
      }
    },
  };
}

export interface ExplorerState {
  // persisted
  selected: string[] | "all";
  filters: Filters;
  /** Sound feedback on moves and imports (persisted). */
  soundEnabled: boolean;
  setSoundEnabled: (on: boolean) => void;
  orientation: Color;
  /** true once the user picked a side (or the one-time auto pick ran) */
  sideChosen: boolean;
  /** true once the user explicitly chose a side (setSide); auto-pick never overrides it */
  sideExplicit: boolean;

  // session
  ready: boolean;
  players: Player[];
  path: string[];
  /** index of the next move to play in `path` (redo cursor) */
  cursor: number;
  hoverMove: string | null;
  result: QueryResult | null;
  resultLoading: boolean;
  summary: SelectionSummary | null;
  selectionVersion: number;
  importOpen: boolean;
  filtersOpen: boolean;
  shortcutsOpen: boolean;
  managerOpen: boolean;

  setReady: (ready: boolean) => void;
  setPlayers: (players: Player[]) => void;
  setSelected: (selected: string[] | "all") => void;
  setFilters: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  setHoverMove: (m: string | null) => void;
  setResult: (r: QueryResult | null) => void;
  setResultLoading: (b: boolean) => void;
  setSummary: (s: SelectionSummary | null) => void;
  bumpSelection: () => void;
  setUi: (patch: Partial<Pick<ExplorerState, "importOpen" | "filtersOpen" | "shortcutsOpen" | "managerOpen">>) => void;

  /** Play a move at the cursor. Illegal input is ignored (never clears the line); SAN is stored as chess.js SAN. */
  playMove: (san: string) => void;
  undo: () => void;
  redo: () => void;
  toStart: () => void;
  toEnd: () => void;
  goTo: (cursor: number) => void;
  /** Replace the line with the legal prefix of `moves` (chess.js SAN). */
  setLine: (moves: string[]) => void;
  /**
   * Load a whole game into the line while keeping the current position: the line becomes
   * the game's (legal) moves and the cursor stays at the visible depth, so → steps through
   * the rest of the game. `key` identifies the game for the Games tab highlight.
   */
  loadGame: (moves: string[], key: string) => void;
  /** Games tab: key + resulting line of the game loaded last (not persisted). */
  loadedGame: { key: string; line: string } | null;
  flip: () => void;
  /** Explicit side switch: sets the viewed color + board orientation; keeps the current line. */
  setSide: (color: Color, explicit?: boolean) => void;
  /** Re-run the selection + position queries after a failed load (see `loadFailed`). */
  retryLoad: () => void;
  /** One-time automatic side pick from the first summary; keeps the current line. */
  autoPickSide: (color: Color) => void;
}

export const useExplorerStore = create<ExplorerState>()(
  persist(
    (set, get) => ({
      selected: "all",
      filters: { color: "white" },
      sideChosen: false,
      sideExplicit: false,
      soundEnabled: true,
      setSoundEnabled: (soundEnabled) => {
        setSoundsEnabled(soundEnabled);
        set({ soundEnabled });
      },
      orientation: "white",

      ready: false,
      players: [],
      path: [],
      cursor: 0,
      hoverMove: null,
      result: null,
      resultLoading: true,
      summary: null,
      selectionVersion: 0,
      importOpen: false,
      filtersOpen: false,
      shortcutsOpen: false,
      managerOpen: false,

      setReady: (ready) => set({ ready }),
      setPlayers: (players) => set({ players }),
      setSelected: (selected) => set({ selected }),
      setFilters: (patch) =>
        set((s) => {
          const filters: Filters = { ...s.filters, ...patch };
          // The move-slice filter is CLI-only: a start slice detaches the tree from the board.
          delete filters.moves_start;
          delete filters.moves_end;
          for (const k of Object.keys(filters) as (keyof Filters)[]) {
            const v = filters[k];
            if (v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v))) delete filters[k];
          }
          // An inverted range (min above max, "from" after "to") can never match: swap it.
          swapIfInverted(filters, "min_my_rating", "max_my_rating");
          swapIfInverted(filters, "min_opponent_rating", "max_opponent_rating");
          swapIfInverted(filters, "date_from", "date_to");
          // The side is always explicit: never drop it. Prefer setSide() for switching.
          if (!filters.color) filters.color = s.filters.color ?? "white";
          const orientation = patch.color ? patch.color : s.orientation;
          return { filters, orientation };
        }),
      clearFilters: () => set((s) => ({ filters: { color: s.filters.color ?? "white" } })),
      setHoverMove: (hoverMove) => set({ hoverMove }),
      setResult: (result) => set({ result }),
      setResultLoading: (resultLoading) => set({ resultLoading }),
      setSummary: (summary) => set({ summary }),
      bumpSelection: () => set((s) => ({ selectionVersion: s.selectionVersion + 1 })),
      setUi: (patch) => set(patch),

      playMove: (san) =>
        set((s) => {
          const lp = linePositions(s.path);
          const at = Math.min(s.cursor, lp.sans.length);
          const move = legalSan(lp.fens[at], san);
          if (move === null) return s; // illegal here (e.g. a click on a stale table): no-op
          // Re-playing the next move of the redo branch keeps the rest of it.
          if (s.path[at] === move) return { cursor: at + 1, hoverMove: null };
          const path = s.path.slice(0, at);
          path.push(move);
          return { path, cursor: path.length, hoverMove: null };
        }),
      undo: () => set((s) => (s.cursor > 0 ? { cursor: s.cursor - 1, hoverMove: null } : s)),
      redo: () => set((s) => (s.cursor < s.path.length ? { cursor: s.cursor + 1, hoverMove: null } : s)),
      toStart: () => set({ cursor: 0, hoverMove: null }),
      toEnd: () => set((s) => ({ cursor: s.path.length, hoverMove: null })),
      goTo: (cursor) => set((s) => ({ cursor: Math.max(0, Math.min(cursor, s.path.length)), hoverMove: null })),
      loadedGame: null,
      loadGame: (moves, key) => {
        const s = get();
        const path = canonicalLine(moves);
        set({ path, cursor: Math.min(s.cursor, path.length), hoverMove: null, loadedGame: { key, line: path.join(" ") } });
      },
      setLine: (moves) => {
        const path = canonicalLine(moves);
        set({ path, cursor: path.length, hoverMove: null });
      },
      flip: () => set({ orientation: get().orientation === "white" ? "black" : "white" }),
      // The line is kept (any legal line is valid for either side); only the side and
      // the board orientation change, so the board and the line panel stay put.
      // `explicit` false is for a side taken from the address bar: it is applied without
      // stopping the automatic pick (only a user click makes the choice permanent).
      setSide: (color, explicit = true) =>
        set((s) => ({
          filters: { ...s.filters, color },
          orientation: color,
          sideChosen: true,
          sideExplicit: explicit ? true : s.sideExplicit,
          hoverMove: null,
        })),
      // A new filters object re-runs the selection effect, which then re-queries the position.
      retryLoad: () => set((s) => ({ filters: { ...s.filters }, resultLoading: true })),
      // Never overrides an explicit choice (e.g. a summary landing after the user's click).
      autoPickSide: (color) =>
        set((s) =>
          s.sideExplicit ? {} : { filters: { ...s.filters, color }, orientation: color, sideChosen: true },
        ),
    }),
    {
      name: "chess-canopy:v1",
      storage: createChangeAwareStorage(),
      version: 5,
      migrate: migratePersisted,
      skipHydration: true,
      partialize: (s) => ({
        selected: s.selected,
        filters: s.filters,
        soundEnabled: s.soundEnabled,
        orientation: s.orientation,
        sideChosen: s.sideChosen,
        sideExplicit: s.sideExplicit,
      }),
    },
  ),
);

function swapIfInverted(f: Filters, lo: "min_my_rating" | "min_opponent_rating" | "date_from", hi: "max_my_rating" | "max_opponent_rating" | "date_to") {
  const a = f[lo] as number | string | null | undefined;
  const b = f[hi] as number | string | null | undefined;
  if (a != null && b != null && a > b) {
    (f as Record<string, unknown>)[lo] = b;
    (f as Record<string, unknown>)[hi] = a;
  }
}

/**
 * True when loading failed before any result existed: nothing is pending and there is no
 * result to show (the sync hook toasts the error and clears the loading flag).
 */
export function loadFailed(s: Pick<ExplorerState, "ready" | "players" | "result" | "resultLoading">): boolean {
  return s.ready && s.players.length > 0 && !s.result && !s.resultLoading;
}

/** Player ids that actually exist; falls back to "all". */
export function effectiveSelection(selected: string[] | "all", players: Player[]): string[] | "all" {
  if (selected === "all") return "all";
  const known = new Set(players.map((p) => p.id));
  const ids = selected.filter((id) => known.has(id));
  return ids.length ? ids : "all";
}


/** Number of active filters; the viewed side is not a filter (nor the CLI-only move slice). */
export function activeFilterCount(f: Filters): number {
  // Rating / date ranges count as one filter each, not per bound.
  let n = 0;
  for (const k of ["result", "opponent", "time_control", "time_control_raw"] as const) if (f[k]) n++;
  if (f.date_from || f.date_to || f.date_preset) n++;
  if (f.min_my_rating != null || f.max_my_rating != null) n++;
  if (f.min_opponent_rating != null || f.max_opponent_rating != null) n++;
  return n;
}

/** Filters as sent to the worker: the CLI-only move slice is never sent from the UI. */
export function selectionFilters(f: Filters): Filters {
  const out: Filters = { ...f };
  delete out.moves_start;
  delete out.moves_end;
  return out;
}

/**
 * True when the shown query result belongs to the current position. While it is false the
 * move table shows the previous position's rows (dimmed) and must not play them.
 */
export function isResultFresh(s: Pick<ExplorerState, "result" | "path" | "cursor">): boolean {
  if (!s.result) return false;
  const visible = s.path.slice(0, s.cursor);
  return s.result.path.length === visible.length && s.result.path.every((m, i) => m === visible[i]);
}

/**
 * Persisted-state migrations.
 * - v0 -> v1: the side became explicit (filters.color always set).
 * - v1 -> v2: drop the move-range filter (`moves_start`/`moves_end`), which the UI no longer
 *   offers; a stored start value made every root move illegal from the start position.
 * - v2 -> v3: `sideExplicit` (a stored side with sideChosen may have come from the auto pick, so
 *   it starts false).
 */
export function migratePersisted(persisted: unknown, version: number): ExplorerState {
  let p = { ...((persisted ?? {}) as Partial<ExplorerState>) };
  if (version < 1) {
    const color: Color = p.filters?.color === "black" ? "black" : "white";
    const explicit = p.filters?.color === "white" || p.filters?.color === "black";
    p = { ...p, filters: { ...(p.filters ?? {}), color }, orientation: explicit ? color : "white", sideChosen: explicit, sideExplicit: explicit };
  }
  if (version < 2 && p.filters) {
    const filters = { ...p.filters };
    delete filters.moves_start;
    delete filters.moves_end;
    p = { ...p, filters };
  }
  if (version < 3 && p.sideExplicit === undefined) p = { ...p, sideExplicit: false };
  // v5: one look only (default board colors, standard sounds). The pickers are gone, so older stored choices are dropped.
  if (version < 5) {
    delete (p as Record<string, unknown>).boardTheme;
    delete (p as Record<string, unknown>).soundTheme;
  }
  return p as ExplorerState;
}
