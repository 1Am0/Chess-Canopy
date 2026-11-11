/**
 * Paper generators for the scrapbook look (round 3).
 *
 * Everything here is pure and deterministic: the same seed and size always give the
 * same SVG path data, so a torn edge, a tape end or a pencil line is irregular but
 * identical on every render, on the server and in the browser. Nothing calls
 * Math.random.
 *
 * All path data is plain absolute commands (M L Q C Z / H V) with at most two decimals.
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

/**
 * Heights in [0, amp] along an edge of the given length: a slow wander (the tear
 * follows a curve), a faster ripple, and the odd small bite. Points are spaced about
 * `step` apart with a little jitter. With `loop` the last point repeats the first
 * height, so the edge tiles seamlessly.
 */
export function edgeProfile(seed: number | string, length: number, amp: number, opts: { step?: number; loop?: boolean } = {}): Pt[] {
  const rng = createRng(seed);
  const step = opts.step ?? 3.2;
  const slowSpacing = Math.max(28, length / 14);
  const slowN = Math.ceil(length / slowSpacing) + 2;
  const slow = Array.from({ length: slowN }, () => rng.next());
  if (opts.loop) slow[slowN - 1] = slow[0];
  const midSpacing = 9;
  const midN = Math.ceil(length / midSpacing) + 2;
  const mid = Array.from({ length: midN }, () => rng.next());
  if (opts.loop) mid[midN - 1] = mid[0];

  const pts: Pt[] = [];
  let x = 0;
  while (x < length) {
    const lowTerm = smoothAt(slow, slowSpacing, x);
    const midTerm = smoothAt(mid, midSpacing, x);
    const grit = rng.next();
    let h = 0.5 * lowTerm + 0.28 * midTerm + 0.22 * grit;
    // an occasional small bite where the paper pulled away
    if (rng.next() < 0.045) h = clamp(h + rng.range(0.18, 0.4), 0, 1);
    pts.push({ x, y: h * amp });
    x += step * rng.range(0.55, 1.45);
  }
  const last = opts.loop ? pts[0].y : rng.next() * amp;
  pts.push({ x: length, y: last });
  if (opts.loop) pts[0] = { x: 0, y: last };
  return pts;
}

const poly = (pts: Pt[]) => pts.map((p) => `L${n2(p.x)} ${n2(p.y)}`).join("");

/**
 * Closed shape for a strip whose top edge is straight (y = 0) and whose bottom edge is
 * torn. The torn edge lives between y = height - amp and y = height; `lift` raises the
 * whole edge (used for the body layer inside a lighter rim layer).
 */
export function tornStripPath(seed: number | string, width: number, height: number, amp: number, opts: { step?: number; loop?: boolean; lift?: number } = {}): string {
  const lift = opts.lift ?? 0;
  const prof = edgeProfile(seed, width, amp, opts);
  const bottom = prof.map((p) => ({ x: p.x, y: clamp(height - amp + p.y - lift, 0, height) }));
  return `M0 0L${n2(width)} 0L${n2(bottom[bottom.length - 1].x)} ${n2(bottom[bottom.length - 1].y)}${poly(bottom.slice(0, -1).reverse())}Z`;
}

/** The torn edge alone, as an open polyline (for a rim stroke). */
export function tornEdgeLine(seed: number | string, width: number, amp: number, opts: { step?: number; loop?: boolean } = {}): string {
  const prof = edgeProfile(seed, width, amp, opts);
  return `M${n2(prof[0].x)} ${n2(prof[0].y)}${poly(prof.slice(1))}`;
}

/**
 * A strip of tape with torn (zig-zag) ends. The long edges are straight to within a
 * fraction of a pixel; each end is a serrated line whose teeth are 2-4px deep. The
 * left and right ends are generated separately, so they never mirror each other.
 */
export function tapePath(seed: number | string, length: number, height: number, jag = 3.4): string {
  const rng = createRng(seed);
  const wob = () => rng.range(0, 0.45);
  const teeth = Math.max(5, Math.round(height / 3.4));

  const end = (side: "left" | "right"): Pt[] => {
    const pts: Pt[] = [];
    for (let i = 0; i <= teeth; i++) {
      const y = (i / teeth) * height + (i === 0 || i === teeth ? 0 : rng.range(-0.7, 0.7));
      const inward = i % 2 === 0 ? rng.range(0, jag * 0.35) : rng.range(jag * 0.55, jag);
      pts.push({ x: side === "left" ? inward : length - inward, y: clamp(y, 0, height) });
    }
    return pts;
  };
  const left = end("left"); // top to bottom
  const right = end("right"); // top to bottom
  // The corner teeth must sit on the long edges.
  left[0].y = wob();
  right[0].y = wob();
  left[left.length - 1].y = height - wob();
  right[right.length - 1].y = height - wob();

  const top = `M${n2(left[0].x)} ${n2(left[0].y)}L${n2(right[0].x)} ${n2(right[0].y)}`;
  const down = right.slice(1).map((p) => `L${n2(p.x)} ${n2(p.y)}`).join("");
  const up = left
    .slice(0, -1)
    .reverse()
    .map((p) => `L${n2(p.x)} ${n2(p.y)}`)
    .join("");
  return `${top}${down}${up}Z`;
}

/**
 * Deckled sheet outline: square corners, edges that wander inward by up to `amp`
 * pixels. Every point stays inside [0, width] x [0, height].
 */
export function deckledPath(seed: number | string, width: number, height: number, amp = 1.4, step = 6): string {
  const rng = createRng(seed);
  const edge = (len: number): number[] => {
    const out: number[] = [];
    let x = 0;
    let slow = rng.next();
    while (x < len) {
      if (rng.next() < 0.18) slow = rng.next();
      out.push(x, (0.55 * slow + 0.45 * rng.next()) * amp);
      x += step * rng.range(0.6, 1.4);
    }
    return out;
  };
  const pts: Pt[] = [];
  const top = edge(width);
  for (let i = 0; i < top.length; i += 2) pts.push({ x: top[i], y: top[i + 1] });
  const right = edge(height);
  for (let i = 0; i < right.length; i += 2) pts.push({ x: width - right[i + 1], y: right[i] });
  const bottom = edge(width);
  for (let i = 0; i < bottom.length; i += 2) pts.push({ x: width - bottom[i], y: height - bottom[i + 1] });
  const left = edge(height);
  for (let i = 0; i < left.length; i += 2) pts.push({ x: left[i + 1], y: height - left[i] });
  const clipped = pts.map((p) => ({ x: clamp(p.x, 0, width), y: clamp(p.y, 0, height) }));
  return `M${n2(clipped[0].x)} ${n2(clipped[0].y)}${poly(clipped.slice(1))}Z`;
}

/**
 * A pencil line from (x1, y1) to (x2, y2) that is almost straight but not quite:
 * the line is cut into short pieces, each point nudged sideways by up to `amp`,
 * and smoothed with quadratic curves. Returns open path data.
 */
export function wobbleLine(seed: number | string, x1: number, y1: number, x2: number, y2: number, amp = 1.1): string {
  const rng = createRng(seed);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const segs = Math.max(2, Math.round(len / 14));
  const pts: Pt[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const off = i === 0 || i === segs ? 0 : rng.range(-amp, amp);
    pts.push({ x: x1 + dx * t + nx * off, y: y1 + dy * t + ny * off });
  }
  let d = `M${n2(pts[0].x)} ${n2(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += `Q${n2(pts[i].x)} ${n2(pts[i].y)} ${n2(mx)} ${n2(my)}`;
  }
  d += `L${n2(pts[pts.length - 1].x)} ${n2(pts[pts.length - 1].y)}`;
  return d;
}

/**
 * A hand-drawn arrow: a gently bowed shaft from (x1, y1) to (x2, y2) and a two-stroke
 * head at the tip, the strokes slightly unequal like a quick pencil flick.
 * `bow` is the sideways bulge of the shaft in pixels (sign picks the side).
 */
export function handArrow(seed: number | string, x1: number, y1: number, x2: number, y2: number, bow = 4): string {
  const rng = createRng(seed);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const b1 = bow + rng.range(-0.8, 0.8);
  const b2 = bow * 0.6 + rng.range(-0.8, 0.8);
  const c1 = { x: x1 + dx * 0.3 + nx * b1, y: y1 + dy * 0.3 + ny * b1 };
  const c2 = { x: x1 + dx * 0.72 + nx * b2, y: y1 + dy * 0.72 + ny * b2 };
  const shaft = `M${n2(x1)} ${n2(y1)}C${n2(c1.x)} ${n2(c1.y)} ${n2(c2.x)} ${n2(c2.y)} ${n2(x2)} ${n2(y2)}`;
  // Heading at the tip: from the second control point towards the end.
  const ang = Math.atan2(y2 - c2.y, x2 - c2.x);
  const head = (spread: number, size: number) =>
    `M${n2(x2)} ${n2(y2)}L${n2(x2 - Math.cos(ang + spread) * size)} ${n2(y2 - Math.sin(ang + spread) * size)}`;
  return `${shaft}${head(0.5 + rng.range(-0.08, 0.08), 7 + rng.range(-0.6, 0.6))}${head(-0.5 + rng.range(-0.08, 0.08), 6.2 + rng.range(-0.6, 0.6))}`;
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

/**
 * Small irregular specks (closed 5-gons) scattered over a w x h tile, for knocking ink out of a stamp or
 * roughening a print. The tile is seamless: specks that would cross an edge are kept inside it.
 */
export function speckPath(seed: number | string, w: number, h: number, count: number, opts: { min?: number; max?: number } = {}): string {
  const rng = createRng(seed);
  const rmin = opts.min ?? 0.35;
  const rmax = opts.max ?? 1.1;
  let d = "";
  for (let i = 0; i < count; i++) {
    const r = rng.range(rmin, rmax) * (rng.next() < 0.1 ? 1.8 : 1);
    const cx = rng.range(r + 0.2, w - r - 0.2);
    const cy = rng.range(r + 0.2, h - r - 0.2);
    const rot = rng.range(0, Math.PI * 2);
    for (let j = 0; j < 5; j++) {
      const a = rot + (j / 5) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const rr = r * rng.range(0.6, 1.1);
      d += `${j === 0 ? "M" : "L"}${n2(clamp(cx + Math.cos(a) * rr, 0, w))} ${n2(clamp(cy + Math.sin(a) * rr, 0, h))}`;
    }
    d += "Z";
  }
  return d || "M0 0Z";
}

/** Full SVG document of a tile that is opaque except for seeded specks (use as a CSS mask: `mask-image`). */
export function speckleMaskSvg(seed: number | string, w: number, h: number, count: number, opts: { min?: number; max?: number } = {}): string {
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
    `<path fill-rule='evenodd' d='M0 0H${w}V${h}H0Z${speckPath(seed, w, h, count, opts)}'/></svg>`
  );
}

export type TicketEnds = "perforated" | "torn";

/**
 * Outline of a ticket w x h whose left and right ends are cut: `perforated` bites half-round notches out of
 * each end at a steady pitch (a tear-off stub), `torn` gives uneven teeth. Top and bottom stay straight.
 * Closed path within [0,w] x [0,h]; use as a `clip-path: path()` on a box of exactly that size.
 */
export function ticketPath(seed: number | string, w: number, h: number, opts: { ends?: TicketEnds; notch?: number; pitch?: number } = {}): string {
  const ends = opts.ends ?? "perforated";
  const r = Math.min(opts.notch ?? 3, h / 4, w / 4);
  const rng = createRng(seed);
  const side = (x: number, dir: 1 | -1): Pt[] => {
    // points from top to bottom on the end at x; dir is the direction INTO the ticket
    const out: Pt[] = [];
    if (ends === "perforated") {
      const pitch = Math.max(2 * r + 1.5, opts.pitch ?? 9);
      const count = Math.max(1, Math.floor(h / pitch));
      const start = (h - (count - 1) * pitch) / 2;
      for (let i = 0; i < count; i++) {
        const cy = start + i * pitch;
        out.push({ x, y: clamp(cy - r, 0, h) }, { x: x + dir * r * 2, y: cy }, { x, y: clamp(cy + r, 0, h) });
      }
      return out;
    }
    const teeth = Math.max(3, Math.round(h / 3.4));
    for (let i = 0; i <= teeth; i++) {
      const y = (i / teeth) * h;
      const inward = i % 2 === 0 ? rng.range(0, r * 0.6) : rng.range(r * 0.7, r * 1.6);
      out.push({ x: x + dir * inward, y: clamp(y + (i === 0 || i === teeth ? 0 : rng.range(-0.6, 0.6)), 0, h) });
    }
    return out;
  };
  const right = side(w, -1);
  const left = side(0, 1).reverse();
  const curve = ends === "perforated";
  const run = (pts: Pt[]) => {
    if (!curve) return pts.map((p) => `L${fmt(p)}`).join("");
    let d = "";
    for (let i = 0; i < pts.length; i += 3) d += `L${fmt(pts[i])}Q${fmt(pts[i + 1])} ${fmt(pts[i + 2])}`;
    return d;
  };
  const leftRun = curve
    ? (() => {
        // `left` is reversed (bottom to top): walk each notch in reverse order too
        let d = "";
        for (let i = 0; i < left.length; i += 3) d += `L${fmt(left[i])}Q${fmt(left[i + 1])} ${fmt(left[i + 2])}`;
        return d;
      })()
    : run(left);
  return `M0 0L${n2(w)} 0${run(right)}L${n2(w)} ${n2(h)}L0 ${n2(h)}${leftRun}Z`;
}

/**
 * One tile of pencil hatching: slanted lines `gap` px apart (measured along x), each a touch different in
 * weight and darkness, drawn so the tile repeats seamlessly. Returns the SVG document and the tile size;
 * set it as a repeating background. `dir` 1 slants like "/", -1 like "\\".
 */
export function pencilHatchSvg(seed: number | string, gap = 5, dir: 1 | -1 = 1, color = "#000"): { svg: string; size: number } {
  const rng = createRng(seed);
  const lines = 4;
  const size = gap * lines;
  let body = "";
  for (let i = 0; i < lines; i++) {
    const c = i * gap;
    const sw = n2(rng.range(0.55, 0.95));
    const op = n2(rng.range(0.5, 0.95));
    // the same diagonal drawn at three offsets so it wraps through the tile edges
    for (const off of [-size, 0, size]) {
      const x0 = c + off;
      const [a, b] = dir === 1 ? [x0, x0 + size] : [x0 + size, x0];
      body += `<path d='M${n2(a)} ${size}L${n2(b)} 0' stroke='${color}' stroke-width='${sw}' stroke-opacity='${op}' stroke-linecap='butt' fill='none'/>`;
    }
  }
  return { svg: `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`, size };
}

/**
 * A hand-ruled check mark in a 16 x 16 box: two strokes with a little seeded unsteadiness in each end.
 * Open path (stroke it with round caps).
 */
export function inkCheckPath(seed: number | string): string {
  const rng = createRng(seed);
  const j = () => rng.range(-0.45, 0.45);
  const p0 = { x: 3 + j(), y: 8.5 + j() };
  const p1 = { x: 6.3 + j() * 0.6, y: 12.1 + j() * 0.6 };
  const p2 = { x: 13.2 + j(), y: 3.7 + j() };
  const c = { x: 9.3 + j(), y: 8.4 + j() };
  return `M${fmt(p0)}L${fmt(p1)}Q${fmt(c)} ${fmt(p2)}`;
}
