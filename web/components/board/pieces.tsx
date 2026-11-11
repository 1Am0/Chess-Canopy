import type { CSSProperties } from "react";
import type { PieceRenderObject } from "react-chessboard";
import { hashSeed } from "@/lib/paper";

/**
 * The "cut-out engravings": the react-chessboard default silhouettes (Cburnett, already shipped with the app)
 * restyled as little pasted specimens.
 *
 *  - every piece is a stack of `<use>` layers over ONE shared set of silhouettes / details / hatch patterns
 *    (`PlateDefs`, rendered once next to the board), so 32 pieces cost no extra geometry and no filters;
 *  - lift shadow = two offset copies of the cut-out (a tight and a soft one), not a blur;
 *  - cut-paper margin = the silhouette stroked wide in paper colour underneath the ink outline;
 *  - white pieces: cream paper, ink outline, fine engraved hatching on the shadow side (right / bottom);
 *  - black pieces: green-black ink, fine cream highlight lines on the lit side (left / top).
 *
 * Everything is deterministic: the only "hand" is a tiny rotation (+-1.3 degrees) seeded by piece + square.
 */

export const PAPER = "#fcf8ea"; // the cut paper of the figures and their margin
export const INK = "#1b231d"; // outline / hatching on white pieces
const BLACK_FILL = "#1f2d26"; // deep green-black
const BLACK_LINE = "#0b110d"; // outline of black pieces
const CREAM_LINE = "#f3eed9"; // highlights on black pieces
const SHADOW = "#241d10"; // lift shadow (warm, not black)

type Kind = "P" | "R" | "N" | "B" | "Q" | "K";

const circ = (cx: number, cy: number, r: number) => `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${2 * r},0 a ${r},${r} 0 1,0 ${-2 * r},0 z`;

interface Shape {
  /** Filled bodies (cut out together). */
  sil: string[];
  /** Un-filled strokes that belong to the cut-out (the king's cross). */
  cross?: string[];
  /** Engraved inner lines (ink on white, cream on black). */
  lines?: string[];
  /** Extra inner lines drawn on black pieces only. */
  linesBlack?: string[];
  /** Small filled marks (eyes). */
  dots?: string[];
}

const SHAPES: Record<Kind, Shape> = {
  P: {
    sil: [
      "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z",
    ],
    lines: ["M 17.2,19 C 20,20.2 25,20.2 27.8,19"],
  },
  R: {
    sil: [
      "M 9,39 L 36,39 L 36,36 L 9,36 z",
      "M 12,36 L 12,32 L 33,32 L 33,36 z",
      "M 12.5,32 L 14,29.5 L 31,29.5 L 32.5,32 z",
      "M 14,29.5 L 14,16.5 L 31,16.5 L 31,29.5 z",
      "M 14,16.5 L 11,14 L 34,14 L 31,16.5 z",
      "M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 z",
    ],
    linesBlack: ["M 12,35.5 L 33,35.5", "M 13,31.5 L 32,31.5", "M 14,29.5 L 31,29.5", "M 14,16.5 L 31,16.5", "M 11,14 L 34,14"],
  },
  N: {
    sil: [
      "M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18",
      "M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10",
    ],
    lines: ["M 15.2,13.6 C 17.4,12.4 19.4,11.4 21,10.4", "M 16.8,17.2 C 19.4,15.6 22.2,14.4 24.6,14.2"],
    dots: ["M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z", "M 14.2,14.6 a 0.55,1.4 -30 1 1 0.01,0 z"],
  },
  B: {
    sil: [
      "M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z",
      "M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z",
      circ(22.5, 8, 2.5),
    ],
    lines: ["M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18"],
  },
  Q: {
    sil: [
      "M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z",
      "M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z",
      circ(6, 12, 2),
      circ(14, 9, 2),
      circ(22.5, 8, 2),
      circ(31, 9, 2),
      circ(39, 12, 2),
    ],
    lines: ["M 11.5,30 C 15,29 30,29 33.5,30", "M 12,33.5 C 18,32.5 27,32.5 33,33.5"],
    linesBlack: ["M 11.5,36.4 C 17.5,37.4 27.5,37.4 33.5,36.4"],
  },
  K: {
    sil: [
      "M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25",
      "M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37",
    ],
    cross: ["M 22.5,11.63 L 22.5,6", "M 20,8 L 25,8"],
    lines: ["M 12.5,30 C 18,27 27,27 32.5,30", "M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5", "M 12.5,37 C 18,34 27,34 32.5,37"],
    linesBlack: [
      "M 32,29.5 C 32,29.5 40.5,25.5 38.03,19.85 C 34.15,14 25,18 22.5,24.5 L 22.5,26.6 L 22.5,24.5 C 20,18 10.85,14 6.97,19.85 C 4.5,25.5 13,29.5 13,29.5",
    ],
  },
};

const KINDS = Object.keys(SHAPES) as Kind[];

/**
 * Shared definitions (silhouettes, inner lines, hatch patterns, light masks). Render it ONCE, near the board; the
 * pieces reference it by id. It is a 0x0 SVG (not display:none, which would drop gradients and patterns in some browsers).
 */
export function PlateDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute", pointerEvents: "none" }}>
      <defs>
        {KINDS.map((k) => {
          const s = SHAPES[k];
          return (
            <g key={k}>
              <g id={`cp-sil-${k}`}>{s.sil.map((d, i) => <path key={i} d={d} />)}</g>
              {s.cross && <g id={`cp-cross-${k}`} fill="none" strokeLinecap="round">{s.cross.map((d, i) => <path key={i} d={d} />)}</g>}
              {s.lines && <g id={`cp-ln-${k}`} fill="none" strokeLinecap="round" strokeLinejoin="round">{s.lines.map((d, i) => <path key={i} d={d} />)}</g>}
              {s.linesBlack && <g id={`cp-lnb-${k}`} fill="none" strokeLinecap="round" strokeLinejoin="round">{s.linesBlack.map((d, i) => <path key={i} d={d} />)}</g>}
              {s.dots && <g id={`cp-dt-${k}`}>{s.dots.map((d, i) => <path key={i} d={d} />)}</g>}
            </g>
          );
        })}

        {/* Engraver's hatching: one pattern per ink, "/" for the first pass, "\" crossing it in the deepest shade. */}
        <pattern id="cp-h-ink" width="1.9" height="1.9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0.95 0V1.9" stroke={INK} strokeWidth="0.34" />
        </pattern>
        <pattern id="cp-h-ink2" width="2.5" height="2.5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <path d="M1.25 0V2.5" stroke={INK} strokeWidth="0.3" />
        </pattern>
        <pattern id="cp-h-cream" width="2.3" height="2.3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M1.15 0V2.3" stroke={CREAM_LINE} strokeWidth="0.42" />
        </pattern>

        {/* Where each pass shows (white = visible). Light comes from the top left. */}
        <linearGradient id="cp-g-shade" gradientUnits="userSpaceOnUse" x1="12" y1="9" x2="36" y2="38">
          <stop offset="0.3" stopColor="#000" />
          <stop offset="0.68" stopColor="#fff" />
        </linearGradient>
        <linearGradient id="cp-g-deep" gradientUnits="userSpaceOnUse" x1="12" y1="9" x2="36" y2="38">
          <stop offset="0.66" stopColor="#000" />
          <stop offset="0.92" stopColor="#fff" />
        </linearGradient>
        <linearGradient id="cp-g-lit" gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="32" y2="30">
          <stop offset="0.06" stopColor="#fff" />
          <stop offset="0.72" stopColor="#000" />
        </linearGradient>
        {["shade", "deep", "lit"].map((m) => (
          <mask key={m} id={`cp-m-${m}`} maskUnits="userSpaceOnUse" x="0" y="0" width="45" height="45">
            <rect width="45" height="45" fill={`url(#cp-g-${m})`} />
          </mask>
        ))}
      </defs>
    </svg>
  );
}

const MARGIN_W = 3.5; // cut-paper margin: paper stroke width, so ~1.1 units of paper beyond the outline

function Specimen({ kind, black, square, svgStyle }: { kind: Kind; black: boolean; square?: string; svgStyle?: CSSProperties }) {
  const s = SHAPES[kind];
  const sil = `#cp-sil-${kind}`;
  const cross = s.cross ? `#cp-cross-${kind}` : null;
  const outline = black ? BLACK_LINE : INK;
  // Pasted by hand: never quite square to the plate.
  const rot = square ? ((hashSeed(`${kind}${black ? "b" : "w"}${square}`) % 1000) / 1000 - 0.5) * 2.6 : 0;
  const detail = black ? CREAM_LINE : INK;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" overflow="visible" style={svgStyle}>
      <g transform={rot ? `rotate(${rot.toFixed(2)} 22.5 24)` : undefined} strokeLinejoin="round" strokeLinecap="round">
        {/* lift shadow: a soft and a tight offset copy of the cut-out */}
        <g fill={SHADOW} stroke={SHADOW}>
          <g transform="translate(0.9 1.5)" opacity="0.13" strokeWidth={MARGIN_W + 1.4}>
            <use href={sil} />
            {cross && <use href={cross} fill="none" />}
          </g>
          <g transform="translate(0.4 0.75)" opacity="0.34" strokeWidth={MARGIN_W}>
            <use href={sil} />
            {cross && <use href={cross} fill="none" />}
          </g>
        </g>
        {/* cut-paper margin */}
        <g fill={PAPER} stroke={PAPER} strokeWidth={MARGIN_W}>
          <use href={sil} />
          {cross && <use href={cross} fill="none" />}
        </g>
        {/* the figure: fill, then engraving, then crisp outline */}
        <use href={sil} fill={black ? BLACK_FILL : PAPER} stroke="none" fillRule="evenodd" />
        {black ? (
          <g mask="url(#cp-m-lit)">
            <use href={sil} fill="url(#cp-h-cream)" stroke="none" opacity="0.9" />
          </g>
        ) : (
          <>
            <g mask="url(#cp-m-shade)">
              <use href={sil} fill="url(#cp-h-ink)" stroke="none" opacity="0.85" />
            </g>
            <g mask="url(#cp-m-deep)">
              <use href={sil} fill="url(#cp-h-ink2)" stroke="none" opacity="0.8" />
            </g>
          </>
        )}
        <use href={sil} fill="none" stroke={outline} strokeWidth="1.35" />
        {cross && <use href={cross} stroke={outline} strokeWidth="1.35" strokeLinejoin="miter" />}
        {s.lines && <use href={`#cp-ln-${kind}`} stroke={detail} strokeWidth={black ? 0.8 : 0.85} opacity={black ? 0.8 : 1} />}
        {black && s.linesBlack && <use href={`#cp-lnb-${kind}`} stroke={detail} strokeWidth="0.8" opacity="0.8" />}
        {s.dots && <use href={`#cp-dt-${kind}`} fill={detail} stroke={detail} strokeWidth="0.4" />}
      </g>
    </svg>
  );
}

function make(kind: Kind, black: boolean) {
  const Piece = (props?: { fill?: string; square?: string; svgStyle?: CSSProperties }) => (
    <Specimen kind={kind} black={black} square={props?.square} svgStyle={props?.svgStyle} />
  );
  return Piece;
}

/** For react-chessboard's `pieces` option. */
export const PLATE_PIECES: PieceRenderObject = Object.fromEntries(
  KINDS.flatMap((k) => [
    [`w${k}`, make(k, false)],
    [`b${k}`, make(k, true)],
  ]),
);

/** The piece under the pointer: a bigger lift (the tight shadow of the sheet itself, plus a little scale). */
export const PLATE_DRAGGING_STYLE: CSSProperties = {
  // --drag-rot is driven per frame by the board (a spring on the pointer's sideways speed): the piece hangs from where you grabbed it and trails behind the drag like air resistance.
  transform: "scale(1.14) rotate(var(--drag-rot, 0deg))",
  transformOrigin: "50% 50%",
  willChange: "transform",
  filter: "drop-shadow(2px 6px 3px rgba(36, 29, 16, 0.4))",
};
