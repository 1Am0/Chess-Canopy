/**
 * Round 5 arrow drafts: pure, deterministic geometry for four board-arrow styles (no React, no randomness).
 *
 * Units: 100 = one square. Every arrow is a straight, constant-width mark that starts a little way out from the origin
 * centre and whose tip stops short of the target centre, so the destination piece stays readable.
 *
 *   a  engraved hatch    hatched shaft in an ink rule, solid ink head
 *   b  pen stroke        constant ink stroke, open mitred chevron head
 *   c  letterpress       paper ribbon with a double ink rule, outlined head
 *   d  printed block     solid ink shaft and head with a reversed key line
 */

export type ArrowStyleId = "a" | "b" | "c" | "d";
export type ArrowLevel = 0 | 1 | 2;
export type ArrowKind = "candidate" | "hover" | "user";
export type Pt = { x: number; y: number };

/** The arrow starts this far out from the origin square centre... */
export const START_GAP = 20;
/** ...and the tip stops this far short of the target centre. */
export const TIP_MARGIN = 20;
/** Extra margin per other arrow that ends on the same square. */
export const CONVERGE_STEP = 6;
/** Paper-coloured under-stroke on each side of a mark. */
export const HALO = 3;

export interface StyleSpec {
  /** Shaft width per frequency step (most played first). */
  width: [number, number, number];
  headLen: [number, number, number];
  headBase: [number, number, number];
  /** Group opacity per step. */
  opacity: [number, number, number];
}

export const STYLES: Record<ArrowStyleId, StyleSpec> = {
  a: { width: [16, 11, 7], headLen: [30, 27, 24], headBase: [36, 32, 28], opacity: [1, 0.86, 0.72] },
  b: { width: [10, 7.5, 5.5], headLen: [31, 29, 27], headBase: [0, 0, 0], opacity: [1, 0.75, 0.55] },
  c: { width: [16, 13, 10], headLen: [32, 30, 28], headBase: [38, 35, 32], opacity: [1, 0.92, 0.82] },
  d: { width: [13, 9, 6], headLen: [32, 30, 28], headBase: [34, 30, 26], opacity: [1, 0.82, 0.64] },
};

/** Half-angle of the open chevron in draft B. */
export const CHEVRON_HALF_ANGLE = (32 * Math.PI) / 180;

export type Paint = "ink" | "paper" | "none";

export interface Layer {
  d: string;
  fill: Paint;
  stroke: Paint;
  /** Stroke width in board units. */
  sw: number;
  cap?: "butt" | "round";
  join?: "miter" | "round";
  dash?: string;
  /** Fill / stroke opacity. */
  fo?: number;
  so?: number;
}

/** Always this many layers, so the SVG node count never depends on the style or the move. */
export const LAYER_COUNT = 4;

export interface ArrowShape {
  /** halo, then up to three ink layers, back to front. */
  layers: Layer[];
  /** Group opacity (the frequency ladder). */
  opacity: number;
  /** Measurements, for tests. */
  tip: Pt;
  start: Pt;
  shaftWidth: number;
  headLength: number;
  headBase: number;
}

export interface ArrowOptions {
  style: ArrowStyleId;
  from: Pt;
  to: Pt;
  level: ArrowLevel;
  kind: ArrowKind;
  /** Rendered pixels per board unit; keeps hairlines and hatching visible on small boards (default 1). */
  scale?: number;
  /** Extra margin before the target centre (converging arrows). */
  extraMargin?: number;
}

const EMPTY: Layer = { d: "", fill: "none", stroke: "none", sw: 0 };

const n1 = (v: number) => (Math.round(v * 10) / 10).toString();
const fmt = (p: Pt) => `${n1(p.x)} ${n1(p.y)}`;
const poly = (pts: Pt[], close = true) => `M${pts.map(fmt).join("L")}${close ? "Z" : ""}`;

/** Width ladder step for a play share relative to the top move (1 = the top move). */
export function levelForShare(rel: number): ArrowLevel {
  return rel >= 0.66 ? 0 : rel >= 0.33 ? 1 : 2;
}

/** The two ends of the mark for a move between two square centres. */
export function arrowEnds(from: Pt, to: Pt, extraMargin = 0): { start: Pt; tip: Pt; u: Pt; len: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const u = { x: dx / d, y: dy / d };
  const margin = TIP_MARGIN + extraMargin;
  // Very short moves keep a visible mark: shrink the gaps instead of inverting the arrow.
  const room = Math.max(d - 36, 0);
  const gaps = START_GAP + margin;
  const k = gaps > room ? room / gaps : 1;
  const start = { x: from.x + u.x * START_GAP * k, y: from.y + u.y * START_GAP * k };
  const tip = { x: to.x - u.x * margin * k, y: to.y - u.y * margin * k };
  return { start, tip, u, len: Math.hypot(tip.x - start.x, tip.y - start.y) };
}

/** Arrow outline in local coordinates (x along, y across): shaft half-width h, head half-base H, head back at b. */
function outline(h: number, H: number, b: number, L: number): Pt[] {
  return [
    { x: 0, y: h },
    { x: b, y: h },
    { x: b, y: H },
    { x: L, y: 0 },
    { x: b, y: -H },
    { x: b, y: -h },
    { x: 0, y: -h },
  ];
}

/** The same outline moved inwards by `d` (mitred), or null when it no longer fits. */
function inset(h: number, H: number, b: number, L: number, d: number): Pt[] | null {
  const hl = L - b;
  const m = H / hl;
  const k = Math.sqrt(1 + m * m);
  const yb = H - m * d - d * k;
  const xt = b + (H - d * k) / m;
  if (h - d < 0.6 || yb < h - d || xt < b + d) return null;
  return [
    { x: d, y: h - d },
    { x: b + d, y: h - d },
    { x: b + d, y: yb },
    { x: xt, y: 0 },
    { x: b + d, y: -yb },
    { x: b + d, y: -(h - d) },
    { x: d, y: -(h - d) },
  ];
}

/** Engraving hatch across a shaft rectangle [x0, x1] x [-h, h]: lines at 45 degrees to the axis, clipped to it. */
export function hatchLines(x0: number, x1: number, h: number, spacing: number): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  const span = 2 * h;
  // A line is x = s + (y + h), y in [-h, h]. Clip it to x0..x1.
  for (let s = x0 - span + spacing / 2; s < x1; s += spacing) {
    let ya = -h;
    let yb = h;
    if (s + 0 < x0) ya = x0 - s - h; // x = s + y + h >= x0
    if (s + span > x1) yb = x1 - s - h;
    if (yb - ya < 0.5) continue;
    out.push([
      { x: s + ya + h, y: ya },
      { x: s + yb + h, y: yb },
    ]);
  }
  return out;
}

export function arrowShape(opts: ArrowOptions): ArrowShape {
  const { style, level, kind } = opts;
  const scale = opts.scale && opts.scale > 0 ? opts.scale : 1;
  const hair = (units: number, px = 1.15) => Math.max(units, px / scale);
  const spec = STYLES[style];
  const { start, tip, u, len } = arrowEnds(opts.from, opts.to, opts.extraMargin);
  const nrm = { x: -u.y, y: u.x };
  const W = (p: Pt): Pt => ({ x: start.x + u.x * p.x + nrm.x * p.y, y: start.y + u.y * p.x + nrm.y * p.y });

  const hover = kind === "hover";
  const lv: ArrowLevel = hover ? (style === "b" ? 1 : 0) : level;
  const w = spec.width[lv];
  const h = w / 2;
  const headLen = Math.min(spec.headLen[lv], len * 0.62);
  const base = style === "b" ? 0 : spec.headBase[lv] * (headLen / spec.headLen[lv]);
  const H = base / 2;
  const b = len - headLen;
  const opacity = hover ? 1 : spec.opacity[lv];
  const halo = HALO;
  const layers: Layer[] = [EMPTY, EMPTY, EMPTY, EMPTY];
  const shape = (pts: Pt[]) => poly(pts.map(W));

  const result = (extra: Partial<ArrowShape> = {}): ArrowShape => ({
    layers,
    opacity,
    tip,
    start,
    shaftWidth: w,
    headLength: headLen,
    headBase: base,
    ...extra,
  });

  if (style === "a") {
    const full = outline(h, H, b, len);
    const ow = hair(1.5);
    layers[0] = { d: shape(full), fill: "paper", stroke: "paper", sw: halo * 2, join: "round", fo: hover ? 0.6 : 0.9, so: hover ? 0.7 : 0.9 };
    if (hover) {
      layers[3] = { d: shape(full), fill: "none", stroke: "ink", sw: hair(1.7), join: "miter" };
      return result();
    }
    const spacing = Math.max(4.6, 3.6 / scale);
    const hatch = hatchLines(0, b, h - ow / 2, spacing);
    // The solid head, in world coordinates.
    layers[1] = { d: shape([{ x: b, y: H }, { x: len, y: 0 }, { x: b, y: -H }]), fill: "ink", stroke: "ink", sw: hair(1.2), join: "miter" };
    layers[2] = {
      d: hatch.map(([p, q]) => `M${fmt(W(p))}L${fmt(W(q))}`).join(""),
      fill: "none",
      stroke: "ink",
      sw: hair(1.1, 1),
      cap: "butt",
    };
    layers[3] = { d: shape([{ x: 0, y: h }, { x: b, y: h }, { x: b, y: -h }, { x: 0, y: -h }]), fill: "none", stroke: "ink", sw: ow, join: "miter" };
    return result();
  }

  if (style === "b") {
    const th = CHEVRON_HALF_ANGLE;
    const cw = w * 0.82; // the chevron is a touch lighter than the shaft so it stays open
    const ext = cw / 2 / Math.sin(th); // the outer mitre point sits this far beyond the polyline vertex
    const v: Pt = { x: len - ext, y: 0 };
    const legLen = (headLen - ext) / Math.cos(th);
    const a: Pt = { x: v.x - Math.cos(th) * legLen, y: Math.sin(th) * legLen };
    const c: Pt = { x: v.x - Math.cos(th) * legLen, y: -Math.sin(th) * legLen };
    const shaft = `M${fmt(W({ x: 0, y: 0 }))}L${fmt(W(v))}`;
    const chev = `M${fmt(W(a))}L${fmt(W(v))}L${fmt(W(c))}`;
    layers[0] = { d: shaft + chev, fill: "none", stroke: "paper", sw: w + halo * 2, cap: "round", join: "round", so: hover ? 0.55 : 0.9 };
    layers[1] = hover
      ? { d: shaft, fill: "none", stroke: "ink", sw: w, cap: "butt", dash: `${n1(w * 1.5)} ${n1(w * 1.0)}` }
      : { d: shaft, fill: "none", stroke: "ink", sw: w, cap: "round" };
    layers[2] = { d: chev, fill: "none", stroke: "ink", sw: cw, cap: "butt", join: "miter" };
    return result({ headBase: 2 * Math.sin(th) * legLen + cw * Math.cos(th), headLength: headLen });
  }

  const full = outline(h, H, b, len);

  if (style === "c") {
    const outer = hover ? hair(1.9) : [2.3, 1.8, 1.5][lv];
    layers[0] = { d: shape(full), fill: "none", stroke: "paper", sw: halo * 2 + outer, join: "round", so: hover ? 0.6 : 0.9 };
    layers[1] = hover
      ? { d: shape(full), fill: "paper", stroke: "ink", sw: outer, join: "miter", dash: "7 5", fo: 0.45 }
      : { d: shape(full), fill: "paper", stroke: "ink", sw: hair(outer, 1.3), join: "miter", fo: 1 };
    const inn = hover || lv === 2 ? null : inset(h, H, b, len, [3.8, 3.2][lv]);
    if (inn) layers[2] = { d: shape(inn), fill: "none", stroke: "ink", sw: hair(lv === 0 ? 1.1 : 0.9, 0.9), join: "miter", so: 0.9 };
    return result();
  }

  // d: printed block
  layers[0] = { d: shape(full), fill: "paper", stroke: "paper", sw: halo * 2, join: "round", fo: hover ? 0.35 : 0.85, so: hover ? 0.6 : 0.9 };
  if (hover) {
    layers[1] = { d: shape(full), fill: "ink", stroke: "ink", sw: hair(2.2), join: "miter", fo: 0.14 };
    return result();
  }
  layers[1] = { d: shape(full), fill: "ink", stroke: "ink", sw: 0, join: "miter" };
  const key = lv === 2 ? null : inset(h, H, b, len, [3.4, 2.5][lv]);
  if (key) layers[2] = { d: shape(key), fill: "none", stroke: "paper", sw: hair(1, 0.9), join: "miter", so: 0.85 };
  return result();
}
