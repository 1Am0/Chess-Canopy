"use client";

import { useRef } from "react";
import { clampGamesPane, GAMES_PANE_DEFAULT, GAMES_PANE_MAX, GAMES_PANE_MIN } from "@/lib/store";

/** Height of the handle in px (the panes share what is left). */
export const HANDLE_PX = 14;

/**
 * Drag handle between the moves and the games list: a strip of tape with a pencilled grip. Drag it, use the
 * arrow keys (Home/End for the limits), or double-click to reset. `value` is the games share of the region;
 * `onLive` is called while dragging (no persistence), `onCommit` once at the end.
 */
export function SplitHandle({
  value,
  region,
  onLive,
  onCommit,
}: {
  value: number;
  region: React.RefObject<HTMLElement | null>;
  onLive: (f: number) => void;
  onCommit: (f: number) => void;
}) {
  const drag = useRef<{ top: number; height: number; last: number } | null>(null);

  const fromY = (y: number) => {
    const d = drag.current!;
    // the games pane is everything below the handle's centre
    return clampGamesPane((d.top + d.height - y - HANDLE_PX / 2) / (d.height - HANDLE_PX));
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize the moves and games lists"
      aria-valuemin={Math.round(GAMES_PANE_MIN * 100)}
      aria-valuemax={Math.round(GAMES_PANE_MAX * 100)}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={`Games list ${Math.round(value * 100)}% of the space`}
      tabIndex={0}
      title="Drag to resize (double-click to reset)"
      className="group/split relative z-10 flex shrink-0 cursor-row-resize touch-none items-center justify-center border-y border-rule-strong bg-[var(--sheet-under)] outline-none select-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring"
      style={{ height: HANDLE_PX }}
      onPointerDown={(e) => {
        const box = region.current?.getBoundingClientRect();
        if (!box) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { top: box.top, height: box.height, last: value };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const f = fromY(e.clientY);
        drag.current.last = f;
        onLive(f);
      }}
      onPointerUp={(e) => {
        if (!drag.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        onCommit(drag.current.last);
        drag.current = null;
      }}
      onPointerCancel={() => {
        if (drag.current) onCommit(drag.current.last);
        drag.current = null;
      }}
      onDoubleClick={() => onCommit(GAMES_PANE_DEFAULT)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.1 : 0.04;
        let f: number | null = null;
        if (e.key === "ArrowUp") f = value + step;
        else if (e.key === "ArrowDown") f = value - step;
        else if (e.key === "Home") f = GAMES_PANE_MAX;
        else if (e.key === "End") f = GAMES_PANE_MIN;
        if (f === null) return;
        e.preventDefault();
        e.stopPropagation(); // the arrow keys also step through the line elsewhere
        onCommit(clampGamesPane(f));
      }}
    >
      {/* the grip: three pencil strokes that darken on hover */}
      <span aria-hidden className="flex flex-col gap-[2px] opacity-60 transition-opacity group-hover/split:opacity-100 group-focus-visible/split:opacity-100">
        <span className="block h-px w-8 bg-pencil" />
        <span className="block h-px w-8 bg-pencil" />
      </span>
    </div>
  );
}
