"use client";

import { useMemo } from "react";
import { useCloudEval } from "@/hooks/use-cloud-eval";
import { formatEval, whiteShare } from "@/lib/cloud-eval";
import { usePosition } from "@/hooks/use-position";
import { useExplorerStore } from "@/lib/store";
import { PencilHatch } from "@/components/paper";
import { createRng, n2 } from "@/lib/paper";
import { cn } from "@/lib/utils";

/** Pawn values that get a printed tick; major ones (0, +-2, +-5) are longer. */
const PAWNS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
const MAJOR = new Set([-5, -2, 0, 2, 5]);
const EDGE_POINTS = 13;
const share = (pawns: number) => whiteShare({ cp: pawns * 100, mate: null, depth: 0 });

/** Wander of the inked boundary in px, one value per point along the strip's width. Fixed seed: the pen never shakes. */
const EDGE_JITTER = (() => {
  const rng = createRng("eval-edge");
  let prev = 0;
  return Array.from({ length: EDGE_POINTS }, () => {
    prev = prev * 0.45 + rng.range(-1.7, 1.7);
    return Math.round(prev * 10) / 10;
  });
})();

/** clip-path polygon that keeps the black share. Same vertex count for every value, so it transitions. */
function inkClip(y: number, blackAtTop: boolean): string {
  const edge = EDGE_JITTER.map((j, i) => {
    const x = (1 - i / (EDGE_POINTS - 1)) * 100; // right to left
    return `${n2(x)}% calc(${n2(y)}% + ${j}px)`;
  });
  return `polygon(${blackAtTop ? "0 0, 100% 0" : "0 100%, 100% 100%"}, ${edge.join(", ")})`;
}

/** Printed ruler ticks, one per pawn, drawn in a 28 x 100 box that stretches with the strip. */
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
    <svg aria-hidden viewBox="0 0 28 100" preserveAspectRatio="none" className="paper-deco pointer-events-none absolute inset-0 size-full overflow-visible">
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
 * Evaluation strip beside the board: a cream measuring card printed with a pawn scale, the black share laid in as an
 * ink fill with a hand-inked boundary, and a small tag pointing at the current value. Data comes from Lichess's cloud
 * Stockfish cache, or a Stockfish running in the browser when the cache has nothing. White sits at White's end of the board.
 *
 * States: loading and no-eval are pencil-hatched (loading breathes); a cloud value has a manila tag, a local one a dashed
 * cream tag; a forced mate has an ink tag.
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
      className="relative w-7 shrink-0 self-stretch rounded-[1px] border border-[var(--bar-border)] bg-[var(--bar-white)] bg-[image:var(--sheet-tile)] shadow-[0.5px_1px_1.5px_var(--btn-drop)]"
    >
      {/* the ruler's own cream ticks (over the white share) */}
      <Ticks whiteAtBottom={whiteAtBottom} color="color-mix(in oklab, var(--bar-black) 70%, transparent)" />
      {ok ? (
        <>
          {/* the ink share, with its cream ticks, cut to the inked boundary */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[var(--bar-black)] transition-[clip-path] duration-300 ease-out motion-reduce:transition-none"
            style={{ clipPath: inkClip(boundary, blackAtTop) }}
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
                "--ev-tag": mate ? "var(--ink)" : local ? "var(--bar-white)" : "var(--tag)",
                "--ev-edge": mate ? "var(--ink)" : local ? "var(--pencil)" : "var(--tag-edge)",
              } as unknown as React.CSSProperties
            }
          >
            {/* the pointer: a little notch aimed at the boundary */}
            <svg width="9" height="5" viewBox="0 0 9 5" className={cn("mx-auto block", !below && "-scale-y-100")}>
              <path d="M0.5 5L4.5 0.8L8.5 5" style={{ fill: "var(--ev-tag)", stroke: "var(--ev-edge)" }} strokeWidth="0.9" />
            </svg>
            <span
              data-tone="manila"
              className={cn(
                "paper-label -mt-px block rounded-[1px] px-[3px] text-center font-mono leading-[13px] font-semibold tracking-tight tabular-nums whitespace-nowrap",
                text.length > 4 ? "text-[8px]" : "text-[9px]",
                local && "border-dashed bg-[var(--bar-white)] text-[var(--bar-white-fg)]",
                mate && "bg-ink text-background",
              )}
              style={{ borderColor: "var(--ev-edge)" }}
            >
              {text}
            </span>
          </div>
        </>
      ) : (
        <PencilHatch gap={4} opacity={0.5} seed="eval-none" className={cn(res === "loading" && "motion-safe:animate-pulse")} />
      )}
    </div>
  );
}
