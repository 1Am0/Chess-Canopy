"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inkArrowPath, inkEllipsePath, inkStrokePath } from "@/lib/paper";

export type OverlayArrowKind = "candidate" | "hover";
export type UserInk = "green" | "red" | "ochre" | "blue" | "graphite";

export interface OverlayArrow {
  from: string;
  to: string;
  kind: OverlayArrowKind;
  /** Stroke width in board units (100 units = 1 square). */
  width: number;
  opacity: number;
}

export interface UserArrow {
  from: string;
  to: string;
  ink: UserInk;
}

export interface OverlayMarks {
  targets?: { to: string; capture: boolean }[];
}

/** Fixed slot count (3 candidates + 1 hover) so the SVG node count never changes. */
const CANDIDATE_SLOTS = 3;
const PLACEHOLDER: OverlayArrow = { from: "a1", to: "a2", kind: "candidate", width: 10, opacity: 0 };

interface Props {
  orientation: "white" | "black";
  arrows: OverlayArrow[];
  userArrows?: UserArrow[];
  marks?: OverlayMarks;
}

type Pt = { x: number; y: number };

/**
 * Coordinates are printed small figures in ink: a deep lichen ink on the cream squares, the plate's near-black green on
 * the lichen-tinted ones (both clear 4.5:1). The board is one fixed look, so these are too.
 */
const COORD_ON_LIGHT = "#4a5c46";
const COORD_ON_DARK = "#18211b";

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

/** Ink is a little slimmer than the old flat arrows (they were far too loud); frequency still scales it. */
const INK_SCALE = 0.78;
const PENCIL_SCALE = 0.62;
const TIP_GAP = 26; // the tip stops short of the target centre so the piece stays visible
const START_GAP = 16;

interface Geometry {
  /** Filled outline of the whole mark (first leg + arrow). */
  d: string;
  /** Second, fainter pencil pass (hover preview only; empty otherwise). */
  d2: string;
}

/**
 * One arrow as filled ink outlines. Seeded by from + to (+ kind), so it is the same hand every render. Knight moves are
 * an L: a stroke along the long leg and an arrow along the short one.
 */
function geometry(from: string, to: string, kind: OverlayArrowKind | "user", width: number, orientation: "white" | "black"): Geometry {
  const s = squareCenter(from, orientation);
  const t = squareCenter(to, orientation);
  const dx = Math.abs(t.x - s.x) / 100;
  const dy = Math.abs(t.y - s.y) / 100;
  const knight = (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
  const seed = `${from}${to}${kind === "hover" ? "p" : ""}`;
  const pencil = kind === "hover";
  const w = width * (pencil ? PENCIL_SCALE : INK_SCALE);

  const legs = (sd: string, off: number, wMul: number, taperTail: number): string => {
    const ww = w * wMul;
    const head = { head: ww * 2.9 + 8, headWidth: ww * 1.9 + 6 };
    if (knight) {
      const corner: Pt = dx === 2 ? { x: t.x, y: s.y } : { x: s.x, y: t.y };
      const d1 = norm(sub(corner, s));
      const d2 = norm(sub(t, corner));
      const n1: Pt = { x: -d1.y * off, y: d1.x * off };
      const n2: Pt = { x: -d2.y * off, y: d2.x * off };
      const a = add(add(s, d1, START_GAP), n1);
      const c1 = add(add(corner, d1, ww * 0.45), n1);
      const c2 = add(corner, n2);
      const tip = add(add(t, d2, -TIP_GAP), n2);
      return (
        inkStrokePath(`${sd}a`, a.x, a.y, c1.x, c1.y, { width: ww }) +
        inkArrowPath(`${sd}b`, c2.x, c2.y, tip.x, tip.y, { width: ww, taper: taperTail, ...head })
      );
    }
    const dir = norm(sub(t, s));
    const n: Pt = { x: -dir.y * off, y: dir.x * off };
    const a = add(add(s, dir, START_GAP), n);
    const tip = add(add(t, dir, -TIP_GAP), n);
    return inkArrowPath(sd, a.x, a.y, tip.x, tip.y, { width: ww, ...head });
  };

  return {
    d: legs(seed, 0, 1, 1),
    d2: pencil ? legs(`${seed}2`, 5, 0.55, 1) : "",
  };
}

const COORD_MIN_PX = 11; // smallest rendered size of the rank / file labels

const OVERLAY_CSS = `
  .board-overlay {
    --ov-halo: color-mix(in oklab, var(--bar-white) 72%, transparent);
    --ov-dot: oklch(0.22 0.03 160 / 0.62);
    --ov-cand: oklch(0.3 0.07 262);
    --ov-pencil: oklch(0.4 0.012 80);
    --ov-green: oklch(0.42 0.1 152);
    --ov-red: oklch(0.47 0.15 28);
    --ov-ochre: oklch(0.58 0.12 78);
    --ov-blue: oklch(0.46 0.1 238);
    --ov-graphite: oklch(0.32 0.01 80);
  }
  .dark .board-overlay {
    --ov-halo: color-mix(in oklab, var(--bar-black) 66%, transparent);
    --ov-dot: oklch(0.15 0.02 160 / 0.5);
    --ov-cand: oklch(0.86 0.07 245);
    --ov-pencil: oklch(0.86 0.012 80);
    --ov-green: oklch(0.82 0.12 152);
    --ov-red: oklch(0.8 0.12 28);
    --ov-ochre: oklch(0.86 0.11 85);
    --ov-blue: oklch(0.84 0.08 235);
    --ov-graphite: oklch(0.88 0.01 80);
  }
  .board-overlay .ov-arrow { transition: opacity 180ms ease; }
  @media (prefers-reduced-motion: reduce) {
    .board-overlay .ov-arrow { transition: none; }
  }
  @media (forced-colors: active) {
    .board-overlay.ov-wash .ov-mark { display: none; }
  }
`;

const INK_VAR: Record<UserInk, string> = {
  green: "var(--ov-green)",
  red: "var(--ov-red)",
  ochre: "var(--ov-ochre)",
  blue: "var(--ov-blue)",
  graphite: "var(--ov-graphite)",
};

const svgBase = "board-overlay pointer-events-none absolute inset-0 z-20 size-full select-none";

export function BoardOverlay({ orientation, arrows, userArrows = [], marks }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  // Coordinates are drawn in board units (800 = the board width), so on a small board the
  // font is scaled up to stay readable.
  const [fontSize, setFontSize] = useState(19);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setFontSize(Math.max(19, Math.round((COORD_MIN_PX * 800) / w)));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slots = useMemo(() => {
    const cands = arrows.filter((a) => a.kind === "candidate").slice(0, CANDIDATE_SLOTS);
    const hover = arrows.find((a) => a.kind === "hover");
    const list: { a: OverlayArrow; show: boolean }[] = [];
    for (let i = 0; i < CANDIDATE_SLOTS; i++) {
      const a = cands[i];
      list.push({ a: a ?? PLACEHOLDER, show: !!a && !hover });
    }
    list.push({ a: hover ?? { ...PLACEHOLDER, kind: "hover" }, show: !!hover });
    return list.map((x) => ({ ...x, g: geometry(x.a.from, x.a.to, x.a.kind, x.a.width, orientation) }));
  }, [arrows, orientation]);

  const users = useMemo(
    () => userArrows.map((u) => ({ ...u, g: geometry(u.from, u.to, "user", 15, orientation) })),
    [userArrows, orientation],
  );

  const coords = useMemo(() => {
    const out: { key: string; x: number; y: number; text: string; fill: string; anchor: "start" | "end" }[] = [];
    for (let i = 0; i < 8; i++) {
      // Files along the bottom row (row 7), ranks down the left column (col 0).
      const file = orientation === "white" ? i : 7 - i;
      const rank = orientation === "white" ? 7 - i : i; // 0-based, i = row
      const darkFile = (file + (orientation === "white" ? 0 : 7)) % 2 === 0;
      out.push({ key: `f${i}`, x: i * 100 + 92, y: 788, text: FILES[file], fill: darkFile ? COORD_ON_DARK : COORD_ON_LIGHT, anchor: "end" });
      const darkRank = (rank + (orientation === "white" ? 0 : 7)) % 2 === 0;
      out.push({ key: `r${i}`, x: 8, y: i * 100 + 22, text: String(rank + 1), fill: darkRank ? COORD_ON_DARK : COORD_ON_LIGHT, anchor: "start" });
    }
    return out;
  }, [orientation]);

  const targets = useMemo(
    () =>
      (marks?.targets ?? []).map((t) => {
        const c = squareCenter(t.to, orientation);
        return { ...t, c, ring: t.capture ? inkEllipsePath(`cap${t.to}`, 88, 88, { pad: 3, turns: 1.08, wobble: 0.025 }) : "" };
      }),
    [marks?.targets, orientation],
  );

  return (
    <>
      <style>{OVERLAY_CSS}</style>

      {/* Layer 1: ink dots / rings and printed coordinates, soaked into the board (multiply in light). */}
      <svg ref={svg} viewBox="0 0 800 800" aria-hidden="true" className={`${svgBase} ov-wash`} style={{ pointerEvents: "none", mixBlendMode: "var(--hilite-blend, multiply)" as React.CSSProperties["mixBlendMode"] }}>
        {targets.map((t) =>
          t.capture ? (
            <path
              key={t.to}
              className="ov-mark"
              d={t.ring}
              transform={`translate(${t.c.x - 44} ${t.c.y - 44})`}
              fill="none"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ stroke: "var(--ov-dot)" }}
            />
          ) : (
            <circle key={t.to} className="ov-mark" cx={t.c.x} cy={t.c.y} r={15} style={{ fill: "var(--ov-dot)" }} />
          ),
        )}
        <g fontFamily="var(--font-serif, Georgia, serif)" fontSize={Math.round(fontSize * 1.08)} fontWeight="600" fontStyle="italic" opacity={0.95} style={{ fontVariantNumeric: "lining-nums" }}>
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
      </svg>

      {/* Layer 2: a thin paper-coloured under-stroke so ink stays readable over dark squares and pieces. */}
      <svg viewBox="0 0 800 800" aria-hidden="true" className={`${svgBase} ov-halo`} style={{ pointerEvents: "none" }}>
        {slots.map(({ a, g, show }, i) => (
          <g key={i} className="ov-arrow" data-slot={i} style={{ opacity: show ? 0.82 : 0, visibility: show ? "visible" : "hidden" }}>
            <g style={{ opacity: a.opacity }}>
              <path d={g.d} strokeWidth={3.2} strokeLinejoin="round" style={{ fill: "var(--ov-halo)", stroke: "var(--ov-halo)" }} />
            </g>
          </g>
        ))}
        {users.map((u) => (
          <path key={`${u.from}${u.to}`} d={u.g.d} strokeWidth={3.2} strokeLinejoin="round" style={{ fill: "var(--ov-halo)", stroke: "var(--ov-halo)", opacity: 0.82 }} />
        ))}
      </svg>

      {/* Layer 3: the ink itself. Candidates are blue-black ink (thicker = played more); the hover preview is graphite pencil. */}
      <svg viewBox="0 0 800 800" aria-hidden="true" className={`${svgBase} ov-ink`} style={{ pointerEvents: "none", mixBlendMode: "var(--hilite-blend, multiply)" as React.CSSProperties["mixBlendMode"] }}>
        {slots.map(({ a, g, show }, i) => (
          <g key={i} className="ov-arrow" data-slot={i} style={{ opacity: show ? 0.82 : 0, visibility: show ? "visible" : "hidden" }}>
            <g style={{ opacity: a.opacity }}>
              <path d={g.d} style={{ fill: a.kind === "hover" ? "var(--ov-pencil)" : "var(--ov-cand)" }} />
              <path d={g.d2} style={{ fill: "var(--ov-pencil)", opacity: 0.7 }} />
            </g>
          </g>
        ))}
        {users.map((u) => (
          <path key={`${u.from}${u.to}`} d={u.g.d} style={{ fill: INK_VAR[u.ink], opacity: 0.86 }} />
        ))}
      </svg>
    </>
  );
}
