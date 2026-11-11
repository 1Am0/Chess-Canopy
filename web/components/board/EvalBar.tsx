"use client";

import { useCloudEval } from "@/hooks/use-cloud-eval";
import { formatEval, whiteShare } from "@/lib/cloud-eval";
import { usePosition } from "@/hooks/use-position";
import { useExplorerStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Evaluation bar beside the board: the black share filled in, the value at the larger side's end.
 * Data comes from Lichess's cloud Stockfish cache, or a Stockfish running in the browser when the cache has nothing.
 * White sits at White's end of the board. Loading and no-eval states are plain gray.
 */
export function EvalBar() {
  const { fen } = usePosition();
  const orientation = useExplorerStore((s) => s.orientation);
  const res = useCloudEval(fen);
  const ok = res !== "loading" && res.status === "ok" ? res.eval : null;
  const sh = ok ? whiteShare(ok) : 50;
  const whiteAtBottom = orientation === "white";
  const text = ok ? formatEval(ok) : "";
  const label = ok
    ? `Stockfish evaluation ${text} (depth ${ok.depth}, ${ok.source === "local" ? "computed in your browser" : "Lichess cloud"})`
    : res === "loading"
      ? "Loading evaluation"
      : res.status === "none"
        ? "No cloud evaluation for this position"
        : "Evaluation unavailable";

  const whiteLarger = sh >= 50;
  // The value sits at the end of the larger side: White's end when White is ahead, else Black's end.
  const atBottom = whiteLarger === whiteAtBottom;

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      data-testid="eval-bar"
      className="relative w-9 shrink-0 self-stretch overflow-hidden rounded-sm border border-bar-border bg-bar-white"
    >
      {ok ? (
        <>
          <div
            aria-hidden
            className={cn(
              "absolute inset-x-0 bg-[var(--bar-black)] transition-[height] duration-300 ease-out motion-reduce:transition-none",
              whiteAtBottom ? "top-0" : "bottom-0",
            )}
            style={{ height: `${100 - sh}%` }}
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 py-0.5 text-center text-xs leading-4 font-semibold tracking-tighter tabular-nums",
              atBottom ? "bottom-0" : "top-0",
              whiteLarger ? "text-[var(--bar-white-fg)]" : "text-[var(--bar-black-fg)]",
            )}
          >
            {text}
          </span>
        </>
      ) : (
        <div aria-hidden className="absolute inset-0 bg-secondary" />
      )}
    </div>
  );
}
