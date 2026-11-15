import { useEffect, useState } from "react";
import { createEvalQueue } from "@/lib/repertoire/eval-queue";
import type { PointEval, RepertoireReport } from "@/lib/repertoire/types";
import { statusOf } from "@/lib/repertoire/verdict";

const FLUSH_MS = 150;
const queue = createEvalQueue();

function initialEvals(report: RepertoireReport | null): Map<string, PointEval> {
  const m = new Map<string, PointEval>();
  for (const p of report?.points ?? []) m.set(p.epd, { epd: p.epd, before: null, moves: {}, status: statusOf(p, undefined) });
  return m;
}

interface State {
  report: RepertoireReport | null;
  evals: Map<string, PointEval>;
  running: boolean;
}

const fresh = (report: RepertoireReport | null): State => ({
  report,
  evals: initialEvals(report),
  running: !!report && report.points.length > 0,
});

/** Engine verdicts for every point of `report`, filled in as the eval queue gets them. */
export function useRepertoireEvals(report: RepertoireReport | null): {
  evals: Map<string, PointEval>;
  done: number;
  total: number;
  running: boolean;
} {
  const [state, setState] = useState<State>(() => fresh(report));
  let current = state;
  if (state.report !== report) {
    // new report: reset during render (React's recommended pattern) so the old evals never show for it
    current = fresh(report);
    setState(current);
  }

  useEffect(() => {
    if (!report || report.points.length === 0) return;
    const ctl = new AbortController();
    const pending = new Map<string, PointEval>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      timer = undefined;
      if (ctl.signal.aborted || pending.size === 0) return;
      const batch = [...pending.values()];
      pending.clear();
      setState((s) => {
        if (s.report !== report) return s;
        const evals = new Map(s.evals);
        for (const pe of batch) evals.set(pe.epd, pe);
        return { ...s, evals };
      });
    };
    const onPoint = (pe: PointEval) => {
      pending.set(pe.epd, pe);
      timer ??= setTimeout(flush, FLUSH_MS);
    };
    void queue
      .run(report, onPoint, ctl.signal)
      .catch(() => {})
      .finally(() => {
        if (ctl.signal.aborted) return;
        clearTimeout(timer);
        flush();
        setState((s) => (s.report === report ? { ...s, running: false } : s));
      });
    return () => {
      ctl.abort();
      clearTimeout(timer);
    };
  }, [report]);

  let done = 0;
  for (const pe of current.evals.values()) if (pe.status !== "pending") done++;
  return { evals: current.evals, done, total: report?.points.length ?? 0, running: current.running };
}
