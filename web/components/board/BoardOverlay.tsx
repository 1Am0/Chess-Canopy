"use client";

import { useMemo } from "react";

export type OverlayArrowKind = "candidate" | "hover";

export interface OverlayArrow {
  from: string;
  to: string;
  kind: OverlayArrowKind;
  /** Pill text, e.g. "42%" or "Bc4 · 64%". */
  label: string;
  /** Stroke width in board units (100 units = 1 square). */
  width: number;
  opacity: number;
  /** Player score in [0, 1] for the target-square ring (candidates only). */
  score?: number;
}

interface Props {
  orientation: "white" | "black";
  arrows: OverlayArrow[];
}

type Pt = { x: number; y: number };

const COLORS = {
  candidate: "var(--arrow-candidate, rgb(21 101 192))",
  hover: "var(--arrow-preview, rgb(245 158 11))",
};
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

function ringColor(score: number): string {
  if (score >= 0.55) return "var(--color-win, rgb(34 160 90))";
  if (score <= 0.45) return "var(--color-loss, rgb(210 70 60))";
  return "var(--color-draw, rgb(140 150 165))";
}

interface Geometry {
  d: string;
  head: string;
  pill: Pt;
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
    return build(pts, tip, finalDir, headLen, headHalf, add(corner, d1, -48));
  }
  finalDir = norm(sub(t, s));
  const tip = add(t, finalDir, -tipGap);
  pts.push(add(s, finalDir, startGap), add(tip, finalDir, -headLen * 0.85));
  return build(pts, tip, finalDir, headLen, headHalf);
}

function build(pts: Pt[], tip: Pt, dir: Pt, headLen: number, headHalf: number, pillAt?: Pt): Geometry {
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const base = add(tip, dir, -headLen);
  const n: Pt = { x: -dir.y, y: dir.x };
  const l = add(base, n, headHalf);
  const r = add(base, n, -headHalf);
  const head = `${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${l.x.toFixed(1)},${l.y.toFixed(1)} ${r.x.toFixed(1)},${r.y.toFixed(1)}`;
  // Pill sits on the shaft just behind the head; clamp to stay past the start.
  const start = pts[0];
  let back = headLen + 30;
  const maxBack = Math.hypot(tip.x - start.x, tip.y - start.y) - 4;
  if (back > maxBack) back = Math.max(maxBack, 0);
  const pill = pillAt ?? add(tip, dir, -back);
  return { d, head, pill };
}

export function BoardOverlay({ orientation, arrows }: Props) {
  const geoms = useMemo(
    () =>
      arrows
        .map((a) => ({ a, g: geometry(a, orientation) })),
    [arrows, orientation],
  );

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
        .board-overlay .ov-arrow { animation: ov-in 180ms ease-out both; transition: opacity 180ms ease; }
        @keyframes ov-in { from { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .board-overlay .ov-arrow { animation: none; transition: none; }
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

      {geoms.map(({ a, g }) => {
        const color = COLORS[a.kind];
        const to = squareCenter(a.to, orientation);
        const pw = a.label.length * 13 + 22;
        return (
          <g key={`${a.kind}-${a.from}${a.to}`} className="ov-arrow">
            <g style={{ opacity: a.opacity }}>
              {a.kind === "candidate" && a.score !== undefined && (
                <circle
                  cx={to.x}
                  cy={to.y}
                  r={43}
                  fill="none"
                  strokeWidth={5}
                  style={{ stroke: ringColor(a.score), opacity: 0.6 }}
                />
              )}
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
            <rect
              x={g.pill.x - pw / 2}
              y={g.pill.y - 18}
              width={pw}
              height={36}
              rx={18}
              strokeWidth={2.5}
              style={{ fill: color, stroke: "rgba(255,255,255,0.85)" }}
            />
            <text
              x={g.pill.x}
              y={g.pill.y + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontSize="22"
              fontWeight="700"
              fill="#fff"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={3}
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {a.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
