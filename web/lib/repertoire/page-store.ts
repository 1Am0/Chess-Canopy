"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clampGamesPane, createChangeAwareStorage } from "@/lib/store";
import { legalSan, linePositions } from "@/lib/position-cache";
import { DEFAULT_MAX_MOVE, DEFAULT_PERIOD_DAYS, MAX_MOVE_CHOICES, PERIOD_CHOICES } from "@/lib/repertoire/types";

/**
 * State of the Repertoire page. The players and the White / Black side are shared with the explorer (lib/store.ts);
 * this store holds what only the Repertoire page has: its time control, period, depth and split (persisted), the selected position and
 * the line shown on its board (session only).
 */
export interface RepertoirePageState {
  // persisted
  /** A time control, null for all games, or "auto" for the time control with the most games. */
  timeControl: string | null | "auto";
  /** Last full move number analysed. */
  maxMove: number;
  /** Only games from the last N days count (null = all time). */
  periodDays: number | null;
  /** Share (0..1) of the sheet's region given to the lists under the split handle (same limits as the explorer's games pane). */
  split: number;

  // session
  /** EPD of the selected report position, or null. */
  selectedEpd: string | null;
  /** The line on the board (chess.js SAN). */
  boardLine: string[];
  /** Number of moves of `boardLine` shown on the board (back / forward step through the line). */
  cursor: number;

  setTimeControl: (tc: string | null | "auto") => void;
  setMaxMove: (n: number) => void;
  setPeriodDays: (days: number | null) => void;
  setSplit: (f: number) => void;
  /** Select a report position (or a saved line) and show its line on the board. */
  select: (epd: string | null, line: string[]) => void;
  /** Play a move at the cursor. Illegal input is ignored; the rest of the line is kept when it is the same move. */
  playMove: (san: string) => void;
  back: () => void;
  forward: () => void;
  /** Back to the starting position (keeps the line, so forward steps through it again). */
  reset: () => void;
  /** Show the first `n` moves of the line. */
  goTo: (n: number) => void;
  /** To the end of the line. */
  toEnd: () => void;
}

/** Default share of the region under the split handle. */
export const SPLIT_DEFAULT = 0.5;

export const useRepertoirePage = create<RepertoirePageState>()(
  persist(
    (set) => ({
      timeControl: "auto",
      maxMove: DEFAULT_MAX_MOVE,
      periodDays: DEFAULT_PERIOD_DAYS,
      split: SPLIT_DEFAULT,
      selectedEpd: null,
      boardLine: [],
      cursor: 0,

      setTimeControl: (timeControl) => set({ timeControl }),
      setMaxMove: (maxMove) => set({ maxMove }),
      setPeriodDays: (periodDays) => set({ periodDays }),
      setSplit: (f) => set({ split: clampGamesPane(f) }),
      select: (selectedEpd, line) => {
        const lp = linePositions(line);
        const boardLine = lp.sans.slice();
        set({ selectedEpd, boardLine, cursor: boardLine.length });
      },
      playMove: (san) =>
        set((s) => {
          const lp = linePositions(s.boardLine);
          const at = Math.min(s.cursor, lp.sans.length);
          const move = legalSan(lp.fens[at], san);
          if (move === null) return s;
          if (s.boardLine[at] === move) return { cursor: at + 1 };
          const boardLine = s.boardLine.slice(0, at);
          boardLine.push(move);
          return { boardLine, cursor: boardLine.length };
        }),
      back: () => set((s) => (s.cursor > 0 ? { cursor: s.cursor - 1 } : s)),
      forward: () => set((s) => (s.cursor < s.boardLine.length ? { cursor: s.cursor + 1 } : s)),
      reset: () => set({ cursor: 0 }),
      goTo: (n) => set((s) => ({ cursor: Math.max(0, Math.min(Math.round(n), s.boardLine.length)) })),
      toEnd: () => set((s) => ({ cursor: s.boardLine.length })),
    }),
    {
      name: "chess-canopy:repertoire:v1",
      storage: createChangeAwareStorage(),
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ timeControl: s.timeControl, maxMove: s.maxMove, periodDays: s.periodDays, split: s.split }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RepertoirePageState>;
        const tc = p.timeControl;
        const maxMove = (MAX_MOVE_CHOICES as readonly number[]).includes(p.maxMove as number) ? (p.maxMove as number) : current.maxMove;
        const periodDays = PERIOD_CHOICES.some((c) => c.days === p.periodDays) ? (p.periodDays as number | null) : current.periodDays;
        // `split` was added later: stores written before it keep the default.
        const split = typeof p.split === "number" && Number.isFinite(p.split) ? clampGamesPane(p.split) : current.split;
        return {
          ...current,
          periodDays,
          split,
          timeControl: tc === undefined || (tc !== null && typeof tc !== "string") ? current.timeControl : tc,
          maxMove,
        };
      },
    },
  ),
);
