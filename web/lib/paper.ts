/**
 * Seeded path generators still used by the board (arrows, ellipses, plate squares, pieces). Pure and deterministic:
 * the same seed and size always give the same SVG path data. Nothing calls Math.random.
 */

export type Pt = { x: number; y: number };

/** FNV-1a: turns a string or number seed into a 32-bit integer. */
export function hashSeed(seed: number | string): number {
  const s = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a tiny, fast, well distributed 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** -1 or 1. */
  sign(): 1 | -1;
}

export function createRng(seed: number | string): Rng {
  const next = mulberry32(hashSeed(seed));
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

/** Two decimals, no trailing noise ("3", "3.5", "3.25"; never "-0"). */
export function n2(v: number): string {
  const r = Math.round(v * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Cosine interpolation between knot values (smooth, no overshoot). */
function smoothAt(knots: number[], spacing: number, x: number): number {
  const f = x / spacing;
  const i = Math.min(Math.floor(f), knots.length - 2);
  const t = f - i;
  const u = (1 - Math.cos(t * Math.PI)) / 2;
  return knots[i] * (1 - u) + knots[i + 1] * u;
}

/** Short wavy strands used as paper fibre: returns open path data for each. */
export function fibreStrands(
  seed: number | string,
  width: number,
  height: number,
  count: number,
  opts: { min?: number; max?: number; margin?: number; angle?: number; spread?: number } = {},
): string[] {
  const rng = createRng(seed);
  const min = opts.min ?? 8;
  const max = opts.max ?? 34;
  const margin = opts.margin ?? 0;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const len = rng.range(min, max);
    const ang = (opts.angle ?? 0) + rng.range(-1, 1) * (opts.spread ?? Math.PI);
    const x = rng.range(margin + max, width - margin - max);
    const y = rng.range(margin + max, height - margin - max);
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    const bend = rng.range(-0.25, 0.25) * len;
    const cx = (x + ex) / 2 - Math.sin(ang) * bend;
    const cy = (y + ey) / 2 + Math.cos(ang) * bend;
    out.push(`M${n2(x)} ${n2(y)}Q${n2(cx)} ${n2(cy)} ${n2(ex)} ${n2(ey)}`);
  }
  return out;
}

/** Wrap an SVG document as a data URI usable in url(...) (CSS background / mask). */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/%20/g, " ").replace(/'/g, "%27")}`;
}

/**
 * Loose structural check for generated path data: only M L H V Q C Z commands with
 * numeric arguments, starting with M. Used by the tests.
 */
export function isWellFormedPath(d: string): boolean {
  if (!/^M/.test(d)) return false;
  if (/[^MLHVQCZ0-9.,\s-]/.test(d)) return false;
  const tokens = d.match(/[MLHVQCZ]|-?\d*\.?\d+/g);
  if (!tokens) return false;
  const arity: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, Z: 0 };
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    const n = arity[cmd];
    if (n === undefined) return false;
    let count = 0;
    while (i < tokens.length && !(tokens[i] in arity)) {
      if (!Number.isFinite(Number(tokens[i]))) return false;
      count++;
      i++;
    }
    if (n === 0 ? count !== 0 : count === 0 || count % n !== 0) return false;
  }
  return true;
}

/** Every coordinate pair of an M/L/Q/C path (curves included), for bounds checks. */
export function pathPoints(d: string): Pt[] {
  const pts: Pt[] = [];
  const re = /([MLQC])([^MLQCZ]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const nums = (m[2].match(/-?\d*\.?\d+/g) ?? []).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  }
  return pts;
}

/* ---- Paper kit v2: ink, marker, stamp, ticket and pencil generators -------------------------- */

const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Smooth 0..1 noise over t in [0, 1]: `knots` random values joined by cosine interpolation. */
function noise1d(rng: Rng, knots: number): (t: number) => number {
  const k = Array.from({ length: Math.max(2, knots) }, () => rng.next());
  return (t) => smoothAt(k, 1 / (k.length - 1), clamp(t, 0, 1));
}

const dotPath = (x: number, y: number, r: number) =>
  `M${n2(x - r)} ${n2(y)}L${n2(x)} ${n2(y - r)}L${n2(x + r)} ${n2(y)}L${n2(x)} ${n2(y + r)}Z`;

export interface InkStrokeOptions {
  /** Stroke width at its fullest, in px (default 4). */
  width?: number;
  /** Width at the start as a fraction of `width` (default 0.45: the nib lands light). */
  taper?: number;
  /** Largest sideways wander of the line in px (default min(1.1, width * 0.22)). */
  wobble?: number;
  /** Samples along the shaft (default 7). Fixed per call, so the path size never depends on the length. */
  samples?: number;
}

export interface InkArrowOptions extends InkStrokeOptions {
  /** Length of the arrow head along the line (default width * 2.6 + 4, capped at 62% of the line). */
  head?: number;
  /** Full width of the head across its barbs (default width * 1.55 + 3). */
  headWidth?: number;
}

type Local = Pt;

/** Left and right outline of a tapered, slightly wandering stroke, in local coordinates (x along, y across). */
function strokeSides(rng: Rng, shaftLen: number, width: number, taper: number, wobble: number, samples: number) {
  const wob = noise1d(rng, 4);
  const jit = noise1d(rng, 5);
  const left: Local[] = [];
  const right: Local[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const prof = (taper + (1 - taper) * smoothstep(0, 0.42, t)) * (1 - 0.1 * smoothstep(0.55, 1, t));
    const h = (width / 2) * prof * (1 + (jit(t) - 0.5) * 0.18);
    // sin(pi t) keeps both ends on the true line, so the tip lands exactly on the target
    const off = (wob(t) - 0.5) * 2 * wobble * Math.sin(Math.PI * t);
    left.push({ x: t * shaftLen, y: off + h });
    right.push({ x: t * shaftLen, y: off - h });
  }
  return { left, right };
}

function toWorld(x1: number, y1: number, ux: number, uy: number) {
  return (p: Local): Pt => ({ x: x1 + ux * p.x - uy * p.y, y: y1 + uy * p.x + ux * p.y });
}

const fmt = (p: Pt) => `${n2(p.x)} ${n2(p.y)}`;

/**
 * A tapered ink stroke from (x1, y1) to (x2, y2) as a FILLED outline (not a stroked line): light where
 * the nib lands, full in the middle, a touch thinner at the end, wandering sideways by a pixel or so.
 * Pure and fast (about 16 points however long the line is); use it for pencil underlines and hover marks.
 */
export function inkStrokePath(seed: number | string, x1: number, y1: number, x2: number, y2: number, opts: InkStrokeOptions = {}): string {
  const w = opts.width ?? 4;
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.5) return dotPath(x1, y1, Math.max(0.5, w / 2));
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const rng = createRng(seed);
  const { left, right } = strokeSides(rng, len, w, opts.taper ?? 0.45, opts.wobble ?? Math.min(1.1, w * 0.22), opts.samples ?? 7);
  const W = toWorld(x1, y1, ux, uy);
  const L = left.map(W);
  const R = right.map(W);
  const startCap = W({ x: -(w / 2) * (opts.taper ?? 0.45) * 1.1, y: (left[0].y + right[0].y) / 2 });
  const endCap = W({ x: len + w * 0.3, y: (left[left.length - 1].y + right[right.length - 1].y) / 2 });
  return (
    `M${fmt(L[0])}` +
    L.slice(1).map((p) => `L${fmt(p)}`).join("") +
    `Q${fmt(endCap)} ${fmt(R[R.length - 1])}` +
    R.slice(0, -1).reverse().map((p) => `L${fmt(p)}`).join("") +
    `Q${fmt(startCap)} ${fmt(L[0])}Z`
  );
}

/**
 * A tapered ink arrow as a FILLED outline: an `inkStrokePath` shaft ending in a nib-like head whose barbs are
 * slightly unequal and whose edges bow out a little, like a brush flick. The tip sits exactly on (x2, y2).
 * Pure, about 22 points whatever the length: fast enough to call for every arrow on every render.
 * Fill it (`fill="var(--ink)"`), do not stroke it. Seeded: the same move always gives the same hand.
 */
export function inkArrowPath(seed: number | string, x1: number, y1: number, x2: number, y2: number, opts: InkArrowOptions = {}): string {
  const w = opts.width ?? 4;
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.5) return dotPath(x1, y1, Math.max(0.5, w / 2));
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const rng = createRng(seed);
  const headLen = Math.min(opts.head ?? w * 2.6 + 4, len * 0.62);
  const hw = (opts.headWidth ?? w * 1.55 + 3) / 2;
  const barbX = len - headLen;
  const shaftLen = barbX + headLen * 0.2; // the shaft runs 20% into the head so no gap shows
  const { left, right } = strokeSides(rng, shaftLen, w, opts.taper ?? 0.45, opts.wobble ?? Math.min(1.1, w * 0.22), opts.samples ?? 7);
  const W = toWorld(x1, y1, ux, uy);
  const L = left.map(W);
  const R = right.map(W);
  const jl = 1 + rng.range(-0.1, 0.12);
  const jr = 1 + rng.range(-0.1, 0.12);
  const sweepL = rng.range(0, headLen * 0.1);
  const sweepR = rng.range(0, headLen * 0.1);
  const barbL = W({ x: barbX - sweepL, y: hw * jl });
  const barbR = W({ x: barbX - sweepR, y: -hw * jr });
  const tip = W({ x: len, y: 0 });
  // the head edges bow outward by a small, unequal amount
  const bowL = W({ x: barbX + headLen * 0.56, y: hw * jl * 0.5 + rng.range(0.1, 0.5) });
  const bowR = W({ x: barbX + headLen * 0.56, y: -hw * jr * 0.5 - rng.range(0.1, 0.5) });
  const startCap = W({ x: -(w / 2) * (opts.taper ?? 0.45) * 1.1, y: (left[0].y + right[0].y) / 2 });
  return (
    `M${fmt(L[0])}` +
    L.slice(1).map((p) => `L${fmt(p)}`).join("") +
    `L${fmt(barbL)}Q${fmt(bowL)} ${fmt(tip)}Q${fmt(bowR)} ${fmt(barbR)}` +
    R.slice().reverse().map((p) => `L${fmt(p)}`).join("") +
    `Q${fmt(startCap)} ${fmt(L[0])}Z`
  );
}

/**
 * A hand-drawn ellipse around a w x h box: about a turn and a bit of pencil, starting top-left of
 * centre and overshooting its own start, the radius drifting outward as the hand goes round. Open path
 * (stroke it, do not fill). Points stay within `pad` px of the box (default 3).
 */
export function inkEllipsePath(seed: number | string, w: number, h: number, opts: { turns?: number; wobble?: number; pad?: number } = {}): string {
  const rng = createRng(seed);
  const turns = opts.turns ?? 1.1;
  const wob = opts.wobble ?? 0.035;
  const pad = opts.pad ?? 3;
  const k = 26;
  const a0 = rng.range(-2.7, -2.2);
  const dir = rng.sign();
  const drift = rng.range(0.025, 0.05);
  const noise = noise1d(rng, 6);
  const cx = w / 2;
  const cy = h / 2;
  const rx = Math.max(1, w / 2 - pad);
  const ry = Math.max(1, h / 2 - pad);
  const pts: Pt[] = [];
  for (let i = 0; i <= k; i++) {
    const t = i / k;
    const th = a0 + dir * t * turns * Math.PI * 2;
    const r = 1 - drift * 0.5 + drift * t + (noise(t) - 0.5) * 2 * wob;
    pts.push({
      x: clamp(cx + rx * r * Math.cos(th), -pad, w + pad),
      y: clamp(cy + ry * r * Math.sin(th), -pad, h + pad),
    });
  }
  let d = `M${fmt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += `Q${fmt(pts[i])} ${n2(mx)} ${n2(my)}`;
  }
  return `${d}L${fmt(pts[pts.length - 1])}`;
}

/**
 * A highlighter wash over a w x h box: top and bottom edges drift by up to `amp` px, and each end is a
 * slightly slanted, uneven chisel cut instead of a straight edge. Closed, within [0,w] x [0,h].
 */
export function washPath(seed: number | string, w: number, h: number, amp = 1.6): string {
  const rng = createRng(seed);
  const endAmp = Math.min(w * 0.12, 3.6);
  const n = Math.max(2, Math.round(w / 18));
  const topN = noise1d(rng, n + 1);
  const botN = noise1d(rng, n + 1);
  const edge = (f: (t: number) => number, y0: number, dir: 1 | -1): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push({ x: t * w, y: clamp(y0 + dir * f(t) * amp, 0, h) });
    }
    return out;
  };
  const top = edge(topN, 0, 1);
  const bottom = edge(botN, h, -1).reverse();
  const lean = rng.range(-1, 1) * endAmp;
  const leftEnd: Pt[] = [0.25, 0.5, 0.75].map((f) => ({ x: clamp(endAmp * 0.5 + lean * (0.5 - f) + rng.range(0, endAmp * 0.5), 0, w), y: h * f }));
  const rightEnd: Pt[] = [0.75, 0.5, 0.25].map((f) => ({ x: clamp(w - endAmp * 0.5 + lean * (f - 0.5) - rng.range(0, endAmp * 0.5), 0, w), y: h * f }));
  const pts = [...top, ...rightEnd, ...bottom, ...leftEnd];
  return `M${fmt(pts[0])}${pts.slice(1).map((p) => `L${fmt(p)}`).join("")}Z`;
}
