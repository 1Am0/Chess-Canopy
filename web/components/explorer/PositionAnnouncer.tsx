"use client";

import { useMemo } from "react";
import { isResultFresh, useExplorerStore } from "@/lib/store";
import { pct, score } from "@/lib/format";
import { lookupOpening } from "@/lib/openings/lookup";
import { usePosition } from "@/hooks/use-position";

/**
 * The one screen-reader live region for the position: the move just played, the opening
 * and the game count / score ("6…Bb4+. Italian Game. 19 games, 55% score"). The visible
 * opening header and summary are not live, so a move is announced once.
 */
export function PositionAnnouncer() {
  const { visible } = usePosition();
  const result = useExplorerStore((s) => s.result);
  const fresh = useExplorerStore(isResultFresh);
  const loading = useExplorerStore((s) => s.resultLoading);
  const opening = useMemo(() => lookupOpening(visible), [visible]);

  const n = visible.length;
  const move = n ? `${Math.ceil(n / 2)}${n % 2 ? "." : "…"}${visible[n - 1]}` : "Starting position";
  const parts = [move];
  if (opening) parts.push(opening.name);
  if (fresh && !loading && result) {
    const t = result.stats.total;
    parts.push(t ? `${t.toLocaleString("en-US")} ${t === 1 ? "game" : "games"}, ${pct(score(result.stats))} score` : "No games");
  }
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {parts.join(". ")}
    </p>
  );
}
