"use client";

import { useMemo } from "react";
import { useCloudEval } from "@/hooks/use-cloud-eval";
import { formatEval, whiteShare } from "@/lib/cloud-eval";
import { usePosition } from "@/hooks/use-position";
import { useExplorerStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Pawn values that get a printed tick; major ones (0, +-2, +-5) are longer. */
const PAWNS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
const MAJOR = new Set([-5, -2, 0, 2, 5]);
const share = (pawns: number) => whiteShare({ cp: pawns * 100, mate: null, depth: 0 });

/** clip-path polygon that keeps the black share. */
function blackClip(y: number, blackAtTop: boolean): string {
  return `polygon(${blackAtTop ? "0 0, 100% 0" : "0 100%, 100% 100%"}, 100% ${y}%, 0 ${y}%)`;
}

/** Ruler ticks, one per pawn, drawn in a 28 x 100 box that stretches with the strip. */
function Ticks({ whiteAtBottom, color }: { whiteAtBottom: boolean; color: string }) {
  const lines = useMemo(
    () =>
      PAWNS.map((p) => {
        const s = share(p);
        const y = whiteAtBottom ? 100 - s : s;
        const major = MAJOR.has(p);
        return { p, y, len: p === 0 ? 13 : major ? 8 : 4, major };
      }),
    [whiteAtBottom],
  );
  return (
    <svg aria-hidden viewBox="0 0 28 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible">
      {lines.map((l) => (
        <g key={l.p} style={{ stroke: color }} strokeWidth={l.p === 0 ? 1.4 : l.major ? 1.1 : 0.8} strokeLinecap="butt">
          <line x1={0} x2={l.len} y1={l.y} y2={l.y} vectorEffect="non-scaling-stroke" />
          {l.major && <line x1={28} x2={28 - Math.min(l.len, 6)} y1={l.y} y2={l.y} vectorEffect="non-scaling-stroke" />}
        </g>
      ))}
    </svg>
  );
}

/**
 * Evaluation strip beside the board: a pawn scale, the black share filled in, and a small tag at the current value.
 * Data comes from Lichess's cloud Stockfish cache, or a Stockfish running in the browser when the cache has nothing.
 * White sits at White's end of the board.
 *
 * States: loading and no-eval are plain gray (loading pulses); a local value has a dashed tag; a forced mate a dark tag.
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

  const blackAtTop = whiteAtBottom;
  // Boundary position, % from the top of the strip.
  const boundary = whiteAtBottom ? 100 - sh : sh;
  const whiteLarger = sh >= 50;
  // The tag sits on the larger side, just past the boundary; "below" = larger side is toward the bottom.
  const below = whiteLarger === whiteAtBottom;
  const mate = ok?.mate != null;
  const local = ok?.source === "local";

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      data-testid="eval-bar"
      className="relative w-9 shrink-0 self-stretch rounded-sm border border-[var(--bar-border)] bg-[var(--bar-white)]"
    >
      {/* ticks over the white share */}
      <Ticks whiteAtBottom={whiteAtBottom} color="color-mix(in oklab, var(--bar-black) 70%, transparent)" />
      {ok ? (
        <>
          {/* the black share, with its ticks, cut at the boundary */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[var(--bar-black)] transition-[clip-path] duration-300 ease-out motion-reduce:transition-none"
            style={{ clipPath: blackClip(boundary, blackAtTop) }}
          >
            <Ticks whiteAtBottom={whiteAtBottom} color="color-mix(in oklab, var(--bar-white) 78%, transparent)" />
          </div>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-1/2 z-[1] flex -translate-x-1/2 transition-[top,bottom] duration-300 ease-out motion-reduce:transition-none",
              below ? "flex-col" : "flex-col-reverse",
            )}
            style={
              {
                ...(below ? { top: `calc(${boundary}% + 3px)` } : { bottom: `calc(${100 - boundary}% + 3px)` }),
                "--ev-tag": mate ? "var(--ink)" : "var(--card)",
                "--ev-edge": mate ? "var(--ink)" : "var(--bar-border)",
              } as unknown as React.CSSProperties
            }
          >
            {/* the pointer: a little notch aimed at the boundary */}
            <svg width="9" height="5" viewBox="0 0 9 5" className={cn("mx-auto block", !below && "-scale-y-100")}>
              <path d="M0.5 5L4.5 0.8L8.5 5" style={{ fill: "var(--ev-tag)", stroke: "var(--ev-edge)" }} strokeWidth="0.9" />
            </svg>
            <span
              className={cn(
                "-mt-px block rounded-sm border bg-card px-[2px] text-center font-mono text-xs leading-[15px] font-semibold tracking-tighter text-foreground tabular-nums whitespace-nowrap",
                local && "border-dashed",
                mate && "bg-ink text-background",
              )}
              style={{ borderColor: "var(--ev-edge)" }}
            >
              {text}
            </span>
          </div>
        </>
      ) : (
        <div aria-hidden className={cn("absolute inset-0 bg-secondary", res === "loading" && "motion-safe:animate-pulse")} />
      )}
    </div>
  );
}
