"use client";

import { useEffect, useState } from "react";
import { fetchCloudEval, type EvalResult } from "@/lib/cloud-eval";
import { evalLocal } from "@/lib/local-eval";

/**
 * Evaluation of `fen`: Lichess's cloud cache first, and when it has nothing (or is unreachable) a local
 * Stockfish search that keeps going deeper (reporting each new score) until the position changes. Debounced so holding an arrow key doesn't spam either.
 */
export function useCloudEval(fen: string): EvalResult | "loading" {
  const [state, setState] = useState<{ fen: string; res: EvalResult } | null>(null);
  // No searching while the tab is hidden: the engine would keep a CPU core busy for nothing.
  const [tabVisible, setTabVisible] = useState(true);
  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  useEffect(() => {
    if (!tabVisible) return;
    const ctl = new AbortController();
    const show = (res: EvalResult) => {
      if (!ctl.signal.aborted) setState({ fen, res });
    };
    const t = setTimeout(() => {
      void fetchCloudEval(fen, ctl.signal).then(async (res) => {
        if (ctl.signal.aborted) return;
        if (res.status === "ok") return show(res);
        // Keep the previous evaluation on screen until the local engine has a first score.
        const local = await evalLocal(fen, {
          signal: ctl.signal,
          continuous: true, // keep going deeper until you leave the position
          onProgress: (e) => show({ status: "ok", eval: { ...e, source: "local" } }),
        });
        if (ctl.signal.aborted) return;
        show(local ? { status: "ok", eval: { ...local, source: "local" } } : res);
      });
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [fen, tabVisible]);
  // Keep showing the previous evaluation until the new one arrives, so the bar doesn't flicker.
  return state ? state.res : "loading";
}
