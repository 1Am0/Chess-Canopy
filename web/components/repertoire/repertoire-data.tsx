"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Color } from "@/lib/engine/types";
import { getExplorer, isExplorerRestart, onExplorerRestart } from "@/lib/explorer-client";
import { effectiveSelection, useExplorerStore } from "@/lib/store";
import { useRepertoirePage } from "@/lib/repertoire/page-store";
import type { DecisionPoint, NewRepertoireEntry, PointEval, RepertoireEntry, RepertoireReport } from "@/lib/repertoire/types";
import { useRepertoireEvals, type ReportPair } from "@/hooks/use-repertoire-evals";

export interface RepertoireData {
  side: Color;
  /** The report for the current settings, or the previous one while a refresh (after a lock) computes. */
  report: RepertoireReport | null;
  /** True while the shown report is not for the current settings (a skeleton is shown instead). */
  stale: boolean;
  loading: boolean;
  error: string | null;
  entries: RepertoireEntry[];
  pointsByEpd: Map<string, DecisionPoint>;
  entriesByEpd: Map<string, RepertoireEntry>;
  evals: Map<string, PointEval>;
  evalDone: number;
  evalTotal: number;
  evalRunning: boolean;
  /** A save or delete is running. */
  busy: boolean;
  retry: () => void;
  lock: (entry: NewRepertoireEntry) => Promise<void>;
  unlock: (epd: string, san: string) => Promise<void>;
}

const Ctx = createContext<RepertoireData | null>(null);

export function useRepertoireData(): RepertoireData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRepertoireData must be used inside <RepertoireDataProvider>");
  return ctx;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Loads the repertoire report and the saved moves for the shared players and side and the page's time control and
 * depth; re-runs when any of them changes, after a lock or unlock, and after a worker restart. Stale responses are
 * ignored. Feeds the report to the engine-verdict queue.
 */
export function RepertoireDataProvider({ children }: { children: React.ReactNode }) {
  const ready = useExplorerStore((s) => s.ready);
  const players = useExplorerStore((s) => s.players);
  const selected = useExplorerStore((s) => s.selected);
  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const timeControl = useRepertoirePage((s) => s.timeControl);
  const maxMove = useRepertoirePage((s) => s.maxMove);
  const periodDays = useRepertoirePage((s) => s.periodDays);

  const [version, setVersion] = useState(0);
  /** Both sides' reports for one set of settings (`key`); the shown side appears first, the other follows. */
  const [result, setResult] = useState<{ key: string; reports: ReportPair } | null>(null);
  /** The same reports once both sides arrived (or failed): what the engine queue works on. */
  const [evalPair, setEvalPair] = useState<ReportPair | null>(null);
  const [error, setError] = useState<{ key: string; side: Color; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<{ side: Color; list: RepertoireEntry[] }>({ side, list: [] });
  const [busy, setBusy] = useState(false);
  const reportReq = useRef(0);
  const entriesReq = useRef(0);

  const selection = useMemo(() => effectiveSelection(selected, players), [selected, players]);
  // Side is not part of the key: both sides load together, so switching sides needs no new request.
  const key = `${JSON.stringify(selection)}|${timeControl}|${maxMove}|${periodDays}`;
  const sideRef = useRef(side);
  sideRef.current = side;

  useEffect(
    () =>
      onExplorerRestart(() => {
        toast.error("The explorer stopped unexpectedly and was restarted.");
        setVersion((n) => n + 1);
      }),
    [],
  );

  // Both sides' reports: the shown side first, then the other.
  useEffect(() => {
    if (!ready || players.length === 0) return;
    const id = ++reportReq.current;
    setLoading(true);
    const first = sideRef.current;
    const sides: Color[] = [first, first === "white" ? "black" : "white"];
    const got: ReportPair = {};
    const load = (s: Color) =>
      getExplorer()
        .repertoireReport(selection, { side: s, timeControl, maxMove, periodDays })
        .then((report) => {
          if (id !== reportReq.current) return;
          got[s] = report;
          setResult((prev) => (prev && prev.key === key ? { key, reports: { ...prev.reports, [s]: report } } : { key, reports: { [s]: report } }));
          setError((e) => (e && e.side === s ? null : e));
          if (s === first) setLoading(false);
        })
        .catch((e) => {
          if (id !== reportReq.current) return;
          if (s === first) setLoading(false);
          if (isExplorerRestart(e)) return; // re-run after the restart
          setError({ key, side: s, text: message(e) });
          if (s === sideRef.current) toast.error(`Could not build the repertoire: ${message(e)}`);
        });
    // The worker answers in order, so the shown side is ready first; the engine starts once both are in.
    void Promise.allSettled(sides.map(load)).then(() => {
      if (id === reportReq.current) setEvalPair({ ...got });
    });
    // `key` stands for selection, timeControl, maxMove and periodDays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, players.length, key, version]);

  // The saved moves of this side.
  useEffect(() => {
    if (!ready) return;
    const id = ++entriesReq.current;
    getExplorer()
      .listRepertoire(side)
      .then((list) => {
        if (id === entriesReq.current) setEntries({ side, list });
      })
      .catch((e) => {
        if (id !== entriesReq.current || isExplorerRestart(e)) return;
        toast.error(`Could not load your repertoire: ${message(e)}`);
      });
  }, [ready, side, version]);

  const report = result?.reports[side] ?? null;
  const stale = !result || result.key !== key || !result.reports[side];
  const { evals, running } = useRepertoireEvals(evalPair, side);
  const total = report?.points.length ?? 0;
  let done = 0;
  for (const p of report?.points ?? []) {
    const st = evals.get(p.epd)?.status;
    if (st && st !== "pending") done++;
  }

  const pointsByEpd = useMemo(() => new Map((report?.points ?? []).map((p) => [p.epd, p])), [report]);
  const entryList = useMemo(() => (entries.side === side ? entries.list : []), [entries, side]);
  const entriesByEpd = useMemo(() => new Map(entryList.map((e) => [e.epd, e])), [entryList]);

  const lock = useCallback(async (entry: NewRepertoireEntry) => {
    setBusy(true);
    try {
      await getExplorer().saveRepertoireMove(entry);
      toast.success(`Locked in ${entry.san}`);
      setVersion((n) => n + 1);
    } catch (e) {
      toast.error(`Could not save the move: ${message(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const unlock = useCallback(
    async (epd: string, san: string) => {
      setBusy(true);
      try {
        await getExplorer().deleteRepertoireMove(side, epd);
        toast.success(`Unlocked ${san}`);
        setVersion((n) => n + 1);
      } catch (e) {
        toast.error(`Could not remove the move: ${message(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [side],
  );

  const retry = useCallback(() => setVersion((n) => n + 1), []);

  const value: RepertoireData = {
    side,
    report,
    stale,
    loading,
    error: error && error.key === key && error.side === side ? error.text : null,
    entries: entryList,
    pointsByEpd,
    entriesByEpd,
    evals,
    evalDone: done,
    evalTotal: total,
    evalRunning: running,
    busy,
    retry,
    lock,
    unlock,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
