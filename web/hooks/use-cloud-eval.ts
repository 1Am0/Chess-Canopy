"use client";

import { useEffect, useState } from "react";
import { fetchCloudEval, type EvalResult } from "@/lib/cloud-eval";

/** Evaluation of `fen` from Lichess's cloud cache, debounced so holding an arrow key doesn't spam it. */
export function useCloudEval(fen: string): EvalResult | "loading" {
  const [state, setState] = useState<{ fen: string; res: EvalResult } | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => {
      void fetchCloudEval(fen, ctl.signal).then((res) => {
        if (!ctl.signal.aborted) setState({ fen, res });
      });
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [fen]);
  // Keep showing the previous evaluation (dimmed) until the new one arrives, so the bar doesn't flicker.
  return state ? state.res : "loading";
}
