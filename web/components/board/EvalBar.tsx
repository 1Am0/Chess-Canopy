"use client";

import { useCloudEval } from "@/hooks/use-cloud-eval";
import { formatEval, whiteShare } from "@/lib/cloud-eval";
import { usePosition } from "@/hooks/use-position";
import { useExplorerStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Evaluation bar beside the board, from Lichess's cloud Stockfish cache. White sits at White's end of the board. */
export function EvalBar() {
  const { fen } = usePosition();
  const orientation = useExplorerStore((s) => s.orientation);
  const res = useCloudEval(fen);
  const ok = res !== "loading" && res.status === "ok" ? res.eval : null;
  const share = ok ? whiteShare(ok) : 50;
  const whiteAtBottom = orientation === "white";
  const text = ok ? formatEval(ok) : "";
  const whiteWinning = ok ? share >= 50 : true;
  const label = ok
    ? `Stockfish evaluation ${text} (depth ${ok.depth}, Lichess cloud)`
    : res === "loading"
      ? "Loading evaluation"
      : res.status === "none"
        ? "No cloud evaluation for this position"
        : "Evaluation unavailable";

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      data-testid="eval-bar"
      className={cn(
        "relative w-7 shrink-0 self-stretch overflow-hidden rounded-md border border-[var(--bar-border)] bg-[var(--bar-black)]",
        !ok && "opacity-60 [background-image:repeating-linear-gradient(135deg,transparent_0_5px,rgb(128_128_128/.25)_5px_10px)]",
      )}
    >
      {ok && (
        <>
          <div
            className={cn("absolute inset-x-0 bg-[var(--bar-white)] transition-[height] duration-300 ease-out", whiteAtBottom ? "bottom-0" : "top-0")}
            style={{ height: `${share}%` }}
          />
          <span
            className={cn(
              "absolute inset-x-0 text-center leading-none font-semibold tracking-tight tabular-nums",
              text.length > 4 ? "text-[9px]" : "text-[10px]",
              whiteWinning ? "text-[var(--bar-white-fg)]" : "text-[var(--bar-black-fg)]",
              // the number sits at the end of the larger side
              whiteWinning === whiteAtBottom ? "bottom-1" : "top-1",
            )}
          >
            {text}
          </span>
        </>
      )}
    </div>
  );
}
