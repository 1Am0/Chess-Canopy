import { useEffect, useRef, useState } from "react";
import { createEvalQueue } from "@/lib/repertoire/eval-queue";
import type { Color } from "@/lib/engine/types";
import type { PointEval, RepertoireReport } from "@/lib/repertoire/types";
import { statusOf } from "@/lib/repertoire/verdict";

const FLUSH_MS = 150;
const queue = createEvalQueue();

/** The reports to evaluate: one per side (either may be missing). Position keys never collide across sides. */
export type ReportPair = Partial<Record<Color, RepertoireReport>>;

function initialEvals(pair: ReportPair | null): Map<string, PointEval> {
  const m = new Map<string, PointEval>();
  for (const r of [pair?.white, pair?.black]) {
    for (const p of r?.points ?? []) m.set(p.epd, { epd: p.epd, before: null, moves: {}, status: statusOf(p, undefined) });
  }
  return m;
}

interface State {
  pair: ReportPair | null;
  evals: Map<string, PointEval>;
  running: boolean;
}

const hasPoints = (pair: ReportPair | null) => !!pair && ((pair.white?.points.length ?? 0) > 0 || (pair.black?.points.length ?? 0) > 0);

const fresh = (pair: ReportPair | null): State => ({ pair, evals: initialEvals(pair), running: hasPoints(pair) });

/**
 * Engine verdicts for every point of both sides' reports, filled in as the eval queue gets them. The side shown when
 * the run starts (`first`) is evaluated first, then the other, so switching sides later finds its evals ready or on the
 * way. `pair` must keep its identity until the reports change.
 */
export function useRepertoireEvals(
  pair: ReportPair | null,
  first: Color,
): {
  evals: Map<string, PointEval>;
  running: boolean;
} {
  const [state, setState] = useState<State>(() => fresh(pair));
  const firstRef = useRef(first);
  firstRef.current = first;
  let current = state;
  if (state.pair !== pair) {
    // new reports: reset during render (React's recommended pattern) so old evals never show for them
    current = fresh(pair);
    setState(current);
  }

  useEffect(() => {
    if (!pair || !hasPoints(pair)) return;
    const other: Color = firstRef.current === "white" ? "black" : "white";
    const reports = [pair[firstRef.current], pair[other]].filter((r): r is RepertoireReport => !!r);
    const ctl = new AbortController();
    const pending = new Map<string, PointEval>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      timer = undefined;
      if (ctl.signal.aborted || pending.size === 0) return;
      const batch = [...pending.values()];
      pending.clear();
      setState((s) => {
        if (s.pair !== pair) return s;
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
      .run(reports, onPoint, ctl.signal)
      .catch(() => {})
      .finally(() => {
        if (ctl.signal.aborted) return;
        clearTimeout(timer);
        flush();
        setState((s) => (s.pair === pair ? { ...s, running: false } : s));
      });
    return () => {
      ctl.abort();
      clearTimeout(timer);
    };
  }, [pair]);

  return { evals: current.evals, running: current.running };
}
