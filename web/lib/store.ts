"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Color, Filters, Player, QueryResult, SelectionSummary } from "@/lib/engine/types";

export type BoardTheme = "green" | "brown" | "blue" | "slate";

const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
  removeItem: (k: string) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* storage unavailable */
    }
  },
}));

export interface ExplorerState {
  // persisted
  selected: string[] | "all";
  filters: Filters;
  boardTheme: BoardTheme;
  orientation: Color;

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
  setBoardTheme: (t: BoardTheme) => void;
  setHoverMove: (m: string | null) => void;
  setResult: (r: QueryResult | null) => void;
  setResultLoading: (b: boolean) => void;
  setSummary: (s: SelectionSummary | null) => void;
  bumpSelection: () => void;
  setUi: (patch: Partial<Pick<ExplorerState, "importOpen" | "filtersOpen" | "shortcutsOpen" | "managerOpen">>) => void;

  playMove: (san: string) => void;
  undo: () => void;
  redo: () => void;
  toStart: () => void;
  toEnd: () => void;
  goTo: (cursor: number) => void;
  setLine: (moves: string[]) => void;
  flip: () => void;
}

export const useExplorerStore = create<ExplorerState>()(
  persist(
    (set, get) => ({
      selected: "all",
      filters: {},
      boardTheme: "green",
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
          for (const k of Object.keys(filters) as (keyof Filters)[]) {
            const v = filters[k];
            if (v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v))) delete filters[k];
          }
          // Switching color also flips the board to that side.
          const orientation = patch.color ? patch.color : s.orientation;
          return { filters, orientation };
        }),
      clearFilters: () => set({ filters: {} }),
      setBoardTheme: (boardTheme) => set({ boardTheme }),
      setHoverMove: (hoverMove) => set({ hoverMove }),
      setResult: (result) => set({ result }),
      setResultLoading: (resultLoading) => set({ resultLoading }),
      setSummary: (summary) => set({ summary }),
      bumpSelection: () => set((s) => ({ selectionVersion: s.selectionVersion + 1 })),
      setUi: (patch) => set(patch),

      playMove: (san) =>
        set((s) => {
          // Re-playing the next move of the redo branch keeps the rest of it.
          if (s.path[s.cursor] === san) return { cursor: s.cursor + 1, hoverMove: null };
          const path = s.path.slice(0, s.cursor);
          path.push(san);
          return { path, cursor: path.length, hoverMove: null };
        }),
      undo: () => set((s) => (s.cursor > 0 ? { cursor: s.cursor - 1, hoverMove: null } : s)),
      redo: () => set((s) => (s.cursor < s.path.length ? { cursor: s.cursor + 1, hoverMove: null } : s)),
      toStart: () => set({ cursor: 0, hoverMove: null }),
      toEnd: () => set((s) => ({ cursor: s.path.length, hoverMove: null })),
      goTo: (cursor) => set((s) => ({ cursor: Math.max(0, Math.min(cursor, s.path.length)), hoverMove: null })),
      setLine: (moves) => set({ path: moves, cursor: moves.length, hoverMove: null }),
      flip: () => set({ orientation: get().orientation === "white" ? "black" : "white" }),
    }),
    {
      name: "chess-canopy:v1",
      storage: safeStorage,
      skipHydration: true,
      partialize: (s) => ({
        selected: s.selected,
        filters: s.filters,
        boardTheme: s.boardTheme,
        orientation: s.orientation,
      }),
    },
  ),
);

/** Player ids that actually exist; falls back to "all". */
export function effectiveSelection(selected: string[] | "all", players: Player[]): string[] | "all" {
  if (selected === "all") return "all";
  const known = new Set(players.map((p) => p.id));
  const ids = selected.filter((id) => known.has(id));
  return ids.length ? ids : "all";
}


export function activeFilterCount(f: Filters): number {
  // Rating / date / move ranges count as one filter each, not per bound.
  let n = 0;
  for (const k of ["color", "result", "opponent", "time_control", "time_control_raw"] as const) if (f[k]) n++;
  if (f.date_from || f.date_to) n++;
  if (f.min_my_rating != null || f.max_my_rating != null) n++;
  if (f.min_opponent_rating != null || f.max_opponent_rating != null) n++;
  if (f.moves_start != null || f.moves_end != null) n++;
  return n;
}
