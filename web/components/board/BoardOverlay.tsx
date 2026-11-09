"use client";

import { useMemo } from "react";

export type OverlayArrowKind = "candidate" | "hover";

export interface OverlayArrow {
  from: string;
  to: string;
  kind: OverlayArrowKind;
  /** Stroke width in board units (100 units = 1 square). */
  width: number;
  opacity: number;
}

/** Fixed slot count (3 candidates + 1 hover) so the SVG node count never changes. */
const CANDIDATE_SLOTS = 3;
const PLACEHOLDER: OverlayArrow = { from: "a1", to: "a2", kind: "candidate", width: 10, opacity: 0 };

interface Props {
  orientation: "white" | "black";
  arrows: OverlayArrow[];
}

type Pt = { x: number; y: number };

const COLORS = {
  candidate: "var(--arrow-candidate, #0a46b9)",
  hover: "var(--arrow-preview, #eb8a00)",
};
const HALO = "rgba(255,255,255,0.55)";
const BOARD_LIGHT = "var(--board-light, #f0d9b5)";
const BOARD_DARK = "var(--board-dark, #b58863)";

const FILES = "abcdefgh";

function squareCenter(sq: string, orientation: "white" | "black"): Pt {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]) - 1;
  const col = orientation === "white" ? f : 7 - f;
  const row = orientation === "white" ? 7 - r : r;
  return { x: col * 100 + 50, y: row * 100 + 50 };
}

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const norm = (v: Pt): Pt => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

interface Geometry {
  d: string;
  head: string;
}

function geometry(a: OverlayArrow, orientation: "white" | "black"): Geometry {
  const s = squareCenter(a.from, orientation);
  const t = squareCenter(a.to, orientation);
  const dx = Math.abs(t.x - s.x) / 100;
  const dy = Math.abs(t.y - s.y) / 100;
  const knight = (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
  const w = a.width;
  const headLen = w * 1.45 + 10;
  const headHalf = w * 0.95 + 4;
  const tipGap = 26; // tip stops short of the target center so the piece stays visible
  const startGap = 16; // start slightly toward the target

  // Waypoints of the shaft center line: start, [corner], end-of-shaft; plus the tip.
  const pts: Pt[] = [];
  let finalDir: Pt;
  if (knight) {
    // Long leg first, then the short leg.
    const corner: Pt = dx === 2 ? { x: t.x, y: s.y } : { x: s.x, y: t.y };
    const d1 = norm(sub(corner, s));
    finalDir = norm(sub(t, corner));
    pts.push(add(s, d1, startGap), corner);
    const tip = add(t, finalDir, -tipGap);
    pts.push(add(tip, finalDir, -headLen * 0.85));
    return build(pts, tip, finalDir, headLen, headHalf);
  }
  finalDir = norm(sub(t, s));
  const tip = add(t, finalDir, -tipGap);
  pts.push(add(s, finalDir, startGap), add(tip, finalDir, -headLen * 0.85));
  return build(pts, tip, finalDir, headLen, headHalf);
}

function build(pts: Pt[], tip: Pt, dir: Pt, headLen: number, headHalf: number): Geometry {
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const base = add(tip, dir, -headLen);
  const n: Pt = { x: -dir.y, y: dir.x };
  const l = add(base, n, headHalf);
  const r = add(base, n, -headHalf);
  const head = `${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${l.x.toFixed(1)},${l.y.toFixed(1)} ${r.x.toFixed(1)},${r.y.toFixed(1)}`;
  return { d, head };
}

export function BoardOverlay({ orientation, arrows }: Props) {
  const slots = useMemo(() => {
    const cands = arrows.filter((a) => a.kind === "candidate").slice(0, CANDIDATE_SLOTS);
    const hover = arrows.find((a) => a.kind === "hover");
    const list: { a: OverlayArrow; show: boolean }[] = [];
    for (let i = 0; i < CANDIDATE_SLOTS; i++) {
      const a = cands[i];
      list.push({ a: a ?? PLACEHOLDER, show: !!a && !hover });
    }
    list.push({ a: hover ?? { ...PLACEHOLDER, kind: "hover" }, show: !!hover });
    return list.map((x) => ({ ...x, g: geometry(x.a, orientation) }));
  }, [arrows, orientation]);

  const coords = useMemo(() => {
    const out: { key: string; x: number; y: number; text: string; fill: string; anchor: "start" | "end" }[] = [];
    for (let i = 0; i < 8; i++) {
      // Files along the bottom row (row 7), ranks down the left column (col 0).
      const file = orientation === "white" ? i : 7 - i;
      const rank = orientation === "white" ? 7 - i : i; // 0-based, i = row
      const darkFile = (file + (orientation === "white" ? 0 : 7)) % 2 === 0;
      out.push({
        key: `f${i}`,
        x: i * 100 + 92,
        y: 788,
        text: FILES[file],
        fill: darkFile ? BOARD_LIGHT : BOARD_DARK,
        anchor: "end",
      });
      const darkRank = (rank + (orientation === "white" ? 0 : 7)) % 2 === 0;
      out.push({
        key: `r${i}`,
        x: 8,
        y: i * 100 + 22,
        text: String(rank + 1),
        fill: darkRank ? BOARD_LIGHT : BOARD_DARK,
        anchor: "start",
      });
    }
    return out;
  }, [orientation]);

  return (
    <svg
      viewBox="0 0 800 800"
      aria-hidden="true"
      className="board-overlay pointer-events-none absolute inset-0 z-20 size-full select-none"
      style={{ pointerEvents: "none" }}
    >
      <style>{`
        .board-overlay .ov-arrow { transition: opacity 180ms ease; }
        @media (prefers-reduced-motion: reduce) {
          .board-overlay .ov-arrow { transition: none; }
        }
      `}</style>

      <g fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="19" fontWeight="600">
        {coords.map((c) => (
          <text
            key={c.key}
            x={c.x}
            y={c.y}
            textAnchor={c.anchor}
            dominantBaseline={c.key.startsWith("r") ? "hanging" : "auto"}
            style={{ fill: c.fill }}
          >
            {c.text}
          </text>
        ))}
      </g>

      {slots.map(({ a, g, show }, i) => {
        const color = COLORS[a.kind];
        return (
          <g
            key={i}
            className="ov-arrow"
            data-slot={i}
            style={{ opacity: show ? 0.75 : 0, visibility: show ? "visible" : "hidden" }}
          >
            <g style={{ opacity: a.opacity }}>
              {/* Thin light halo beneath the arrow so it reads on dark squares. */}
              <path
                d={g.d}
                fill="none"
                strokeWidth={a.width + 4}
                strokeLinejoin="round"
                strokeLinecap="butt"
                style={{ stroke: HALO }}
              />
              <polygon points={g.head} strokeWidth={4} strokeLinejoin="round" style={{ fill: HALO, stroke: HALO }} />
              <path
                d={g.d}
                fill="none"
                strokeWidth={a.width}
                strokeLinejoin="round"
                strokeLinecap="butt"
                style={{ stroke: color }}
              />
              <polygon points={g.head} style={{ fill: color }} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
