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
