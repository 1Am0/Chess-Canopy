import { LEAF, type CanopyTree } from "./types";

export type Rgb = readonly [number, number, number];

const toLin = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const fromLin = (v: number): number => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
};

/** sRGB (0..255) to OKLab. */
export function toOklab(c: Rgb): [number, number, number] {
  const r = toLin(c[0]);
  const g = toLin(c[1]);
  const b = toLin(c[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function fromOklab(L: number, a: number, b: number): Rgb {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** Perceptual interpolation (OKLab). t is clamped; the endpoints are returned exactly. */
export function oklabMix(a: Rgb, b: Rgb, t: number): Rgb {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const A = toOklab(a);
  const B = toOklab(b);
  return fromOklab(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

export const RAMP_STEPS = 65;

/** `steps` CSS colors, low -> mid -> high, interpolated in OKLab. Index 0 = low, middle = mid, last = high. */
export function makeRamp(low: Rgb, mid: Rgb, high: Rgb, steps = RAMP_STEPS): string[] {
  const out: string[] = [];
  const n = Math.max(2, steps);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const c = u <= 0.5 ? oklabMix(low, mid, u * 2) : oklabMix(mid, high, (u - 0.5) * 2);
    out.push(`rgb(${c[0]}, ${c[1]}, ${c[2]})`);
  }
  return out;
}

/** 0.30 -> 0, 0.50 -> 0.5, 0.70 -> 1, clamped. */
export function scoreT(score: number): number {
  return Math.min(1, Math.max(0, (score - 0.3) / 0.4));
}

/** Score used to colour a node: shrunk toward 50% for small samples; a single game is 1 / 0.5 / 0. */
export function displayScore(t: CanopyTree, i: number): number {
  if (t.kind[i] === LEAF) return t.wins[i] > 0 ? 1 : t.draws[i] > 0 ? 0.5 : 0;
  return (t.wins[i] + t.draws[i] / 2 + 1) / (t.games[i] + 2);
}

/** Plain (w + d/2) / n for text; 0.5 when there are no games. */
export function rawScore(t: CanopyTree, i: number): number {
  const n = t.games[i];
  return n > 0 ? (t.wins[i] + t.draws[i] / 2) / n : 0.5;
}

/** Index into a ramp for a 0..1 score. */
export function rampIndex(ramp: readonly string[], score: number): number {
  return Math.round(scoreT(score) * (ramp.length - 1));
}
