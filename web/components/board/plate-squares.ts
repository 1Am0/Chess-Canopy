import { createRng, fibreStrands, hashSeed, n2, svgDataUri } from "@/lib/paper";

/**
 * Square textures for the "specimen plate" (light mode, Lichen only).
 *
 *  - light squares: cream sheet paper (flat colour + a very faint fibre tile);
 *  - dark squares: a flat lichen base printed with an engraved tint: fine "/" ruling in a deeper lichen ink, broken
 *    into dashes, with a little stipple.
 *
 * Each kind comes in a few seeded variants (ink density and breaks differ a few percent), assigned per square by a
 * hash of its name. Tiles are generated once and exposed as CSS custom properties on the board, so a square's own
 * style is just `background-image: var(--cp-d3)`; the board stays cheap (12 data URIs in total).
 */

export const PLATE_LIGHT = "#ece6d2";
export const PLATE_DARK = "#8fa08a";
export const PLATE_RULE = "#566b52"; // deeper lichen ink for the tint and the frame's inner rule
export const PLATE_INK = "#1e2a22"; // printed figures on the dark squares

/**
 * The printed plate frame, drawn outward from the board edge in the mat gap (box-shadow only, so the board's rect
 * never changes): a hairline, a strip of paper, then the heavier rule. Total 3.5px; the gap beside the eval bar is 4px.
 */
export const PLATE_FRAME = `0 0 0 0.75px ${PLATE_RULE}, 0 0 0 2px var(--sheet, #fbf6e4), 0 0 0 3.5px ${PLATE_INK}`;

export const VARIANTS = 6;
const RULING = 8; // distance between ruled lines along an axis (100 units = one square, 8 divides 200: lines run on across squares)

const tile = (body: string) =>
  `url("${svgDataUri(`<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'>${body}</svg>`)}")`;

/** Engraved tint for a dark square. `density` is the seeded per-square ink variation (about 0.88 .. 1.12). */
export function darkTile(seed: string, density: number): string {
  const rng = createRng(seed);
  let d = "";
  // lines x + y = c, drawn bottom-left to top-right, as 1-3 dashes with engraver's lifts between
  for (let c = RULING / 2; c < 200; c += RULING) {
    const x0 = Math.max(0, c - 100);
    const x1 = Math.min(100, c);
    const len = x1 - x0;
    if (len < 3) continue;
    const cuts = rng.int(0, 2);
    const stops = [0];
    for (let i = 0; i < cuts; i++) stops.push(rng.range(0.15, 0.85));
    stops.sort((a, b) => a - b);
    stops.push(1);
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i] + (i ? 0.03 : 0);
      const b = stops[i + 1] - (i < stops.length - 2 ? 0.03 : 0);
      if (b - a < 0.06) continue;
      const xa = x0 + len * a;
      const xb = x0 + len * b;
      d += `M${n2(xa)} ${n2(c - xa)}L${n2(xb)} ${n2(c - xb)}`;
    }
  }
  // two weights of line so the ruling does not look machine-ground
  const lines = d.split("M").filter(Boolean).map((s) => `M${s}`);
  const heavy = lines.filter(() => rng.next() < 0.35).join("");
  const light = lines.join("");
  let stipple = "";
  const dots = Math.round(10 * density);
  for (let i = 0; i < dots; i++) {
    stipple += `M${n2(rng.range(3, 97))} ${n2(rng.range(3, 97))}h${n2(rng.range(0.5, 1.1))}`;
  }
  const fibre = fibreStrands(`${seed}f`, 100, 100, 5, { min: 8, max: 20, margin: 0, spread: Math.PI }).join("");
  return tile(
    `<path d='${light}' fill='none' stroke='${PLATE_RULE}' stroke-width='0.7' stroke-opacity='${n2(0.23 * density)}'/>` +
      `<path d='${heavy}' fill='none' stroke='${PLATE_RULE}' stroke-width='1.05' stroke-opacity='${n2(0.18 * density)}'/>` +
      `<path d='${stipple}' fill='none' stroke='#33432f' stroke-width='1.3' stroke-linecap='round' stroke-opacity='${n2(0.17 * density)}'/>` +
      `<path d='${fibre}' fill='none' stroke='#e8efe2' stroke-width='0.6' stroke-linecap='round' stroke-opacity='0.16'/>`,
  );
}

/** Faint cream sheet paper: a few fibres, a couple of specks. */
export function lightTile(seed: string, density: number): string {
  const rng = createRng(seed);
  const strands = fibreStrands(seed, 100, 100, 9, { min: 8, max: 20, margin: 0, spread: Math.PI });
  const half = Math.ceil(strands.length / 2);
  let specks = "";
  for (let i = 0; i < 4; i++) specks += `M${n2(rng.range(4, 96))} ${n2(rng.range(4, 96))}h${n2(rng.range(0.4, 0.9))}`;
  return tile(
    `<path d='${strands.slice(0, half).join("")}' fill='none' stroke='#6b5a30' stroke-width='0.6' stroke-linecap='round' stroke-opacity='${n2(0.055 * density)}'/>` +
      `<path d='${strands.slice(half).join("")}' fill='none' stroke='#fff' stroke-width='0.8' stroke-linecap='round' stroke-opacity='0.3'/>` +
      `<path d='${specks}' fill='none' stroke='#6b5a30' stroke-width='1.1' stroke-linecap='round' stroke-opacity='${n2(0.09 * density)}'/>`,
  );
}

const density = (seed: string) => 0.88 + (hashSeed(`${seed}d`) % 1000) / 1000 * 0.24;

/** `--cp-d0..5` (dark) and `--cp-l0..5` (light): the tiles, ready to be set as custom properties on the board element. */
export const PLATE_VARS: Record<string, string> = (() => {
  const v: Record<string, string> = {};
  for (let i = 0; i < VARIANTS; i++) {
    v[`--cp-d${i}`] = darkTile(`plate-dark-${i}`, density(`dark${i}`));
    v[`--cp-l${i}`] = lightTile(`plate-light-${i}`, density(`light${i}`));
  }
  return v;
})();

/** a1 is dark: file + rank parity even means a dark square. */
export const isDarkSquare = (sq: string): boolean => (sq.charCodeAt(0) - 97 + Number(sq[1]) - 1) % 2 === 0;

/** The tile variable for a square (seeded by its name, so it never changes between renders or orientations). */
export function squareTile(sq: string): string {
  return `var(--cp-${isDarkSquare(sq) ? "d" : "l"}${hashSeed(`sq${sq}`) % VARIANTS})`;
}
