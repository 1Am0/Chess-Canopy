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
  /** true once the user picked a side (or the one-time auto pick ran) */
  sideChosen: boolean;

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
  /** Explicit side switch: sets the viewed color + board orientation and resets the line. */
  setSide: (color: Color) => void;
  /** One-time automatic side pick from the first summary; keeps the current line. */
  autoPickSide: (color: Color) => void;
}

export const useExplorerStore = create<ExplorerState>()(
  persist(
    (set, get) => ({
      selected: "all",
      filters: { color: "white" },
      sideChosen: false,
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
          // The side is always explicit: never drop it. Prefer setSide() for switching.
          if (!filters.color) filters.color = s.filters.color ?? "white";
          const orientation = patch.color ? patch.color : s.orientation;
          return { filters, orientation };
        }),
      clearFilters: () => set((s) => ({ filters: { color: s.filters.color ?? "white" } })),
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
      setSide: (color) =>
        set((s) => ({
          filters: { ...s.filters, color },
          orientation: color,
          sideChosen: true,
          path: [],
          cursor: 0,
          hoverMove: null,
        })),
      autoPickSide: (color) =>
        set((s) => ({ filters: { ...s.filters, color }, orientation: color, sideChosen: true })),
    }),
    {
      name: "chess-canopy:v1",
      storage: safeStorage,
      version: 1,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<ExplorerState>;
        const color: Color = p.filters?.color === "black" ? "black" : "white";
        const explicit = p.filters?.color === "white" || p.filters?.color === "black";
        return {
          ...p,
          filters: { ...(p.filters ?? {}), color },
          orientation: explicit ? color : "white",
          sideChosen: explicit,
        } as ExplorerState;
      },
      skipHydration: true,
      partialize: (s) => ({
        selected: s.selected,
        filters: s.filters,
        boardTheme: s.boardTheme,
        orientation: s.orientation,
        sideChosen: s.sideChosen,
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


/** Number of active filters; the viewed side is not a filter. */
export function activeFilterCount(f: Filters): number {
  // Rating / date / move ranges count as one filter each, not per bound.
  let n = 0;
  for (const k of ["result", "opponent", "time_control", "time_control_raw"] as const) if (f[k]) n++;
  if (f.date_from || f.date_to) n++;
  if (f.min_my_rating != null || f.max_my_rating != null) n++;
  if (f.min_opponent_rating != null || f.max_opponent_rating != null) n++;
  if (f.moves_start != null || f.moves_end != null) n++;
  return n;
}
