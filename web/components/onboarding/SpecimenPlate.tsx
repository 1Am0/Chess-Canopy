import { cn } from "@/lib/utils";

type Node = { san: string; n: number; score: number };
type Branch = Node & { kids: Node[] };

/** Hand-authored sample data: decorative only, not computed from anything. Kids sum to their parent. */
const SAMPLE: Branch[] = [
  { san: "1… c5", n: 14, score: 0.5, kids: [{ san: "2. Nf3", n: 10, score: 0.54 }, { san: "2. Nc3", n: 4, score: 0.36 }] },
  { san: "1… e5", n: 12, score: 0.66, kids: [{ san: "2. Nf3", n: 9, score: 0.72 }, { san: "2. Bc4", n: 3, score: 0.5 }] },
  { san: "1… e6", n: 8, score: 0.47, kids: [{ san: "2. d4", n: 8, score: 0.47 }] },
  { san: "1… c6", n: 6, score: 0.34, kids: [{ san: "2. d4", n: 6, score: 0.34 }] },
];

// 4:3 viewBox. Text sizes are in these units (~11px at the plate's desktop width).
const W = 480;
const H = 360;
const PAD_TOP = 26; // room for the root label
const PAD_BOTTOM = 10;
const GAP = 4;
const BAR = 5;
const X_ROOT = 0;
const X_L1 = 150;
const X_L2 = 322;
const LABEL_COL = 66; // clear space right of the level-1 bars; ribbons resume after it

const LEAVES = SAMPLE.reduce((s, b) => s + b.kids.length, 0);
const TOTAL = SAMPLE.reduce((s, b) => s + b.n, 0);
const SCALE = (H - PAD_TOP - PAD_BOTTOM - GAP * (LEAVES - 1)) / TOTAL; // units per game

/** Score → bar/ribbon colour, interpolating low → mid → high in oklch. */
function scoreColour(score: number, alpha = 100) {
  const s = Math.min(1, Math.max(0, score));
  const base =
    s < 0.5
      ? `color-mix(in oklch, var(--tree-mid) ${Math.round(s * 200)}%, var(--tree-low))`
      : `color-mix(in oklch, var(--tree-high) ${Math.round((s - 0.5) * 200)}%, var(--tree-mid))`;
  return alpha >= 100 ? base : `color-mix(in oklch, ${base} ${alpha}%, transparent)`;
}

/** Filled band between two vertical extents, joined by an S-curve. */
function band(xa: number, a0: number, a1: number, xb: number, b0: number, b1: number) {
  const m = (xa + xb) / 2;
  return `M${xa} ${a0} C${m} ${a0} ${m} ${b0} ${xb} ${b0} L${xb} ${b1} C${m} ${b1} ${m} ${a1} ${xa} ${a1} Z`;
}

type Placed = Node & { y0: number; y1: number };

function layout() {
  // Level 1: branches stacked with gaps, centred on the full-height stack.
  const l1Height = TOTAL * SCALE + GAP * (SAMPLE.length - 1);
  let y = PAD_TOP;
  const rootH = TOTAL * SCALE;
  const rootY0 = PAD_TOP + (l1Height - rootH) / 2;
  const l1: (Placed & { kids: (Placed & { src0: number; src1: number })[]; src0: number; src1: number })[] = [];
  let rootCursor = rootY0;
  // Level 2 leaves stack top to bottom with their own gaps.
  let leafY = PAD_TOP;
  for (const b of SAMPLE) {
    const h = b.n * SCALE;
    const kids = b.kids.map((k) => {
      const kh = k.n * SCALE;
      const out = { ...k, y0: leafY, y1: leafY + kh, src0: 0, src1: 0 };
      leafY += kh + GAP;
      return out;
    });
    let kc = y;
    for (const k of kids) {
      k.src0 = kc;
      k.src1 = kc + k.n * SCALE;
      kc = k.src1;
    }
    l1.push({ ...b, y0: y, y1: y + h, src0: rootCursor, src1: rootCursor + h, kids });
    rootCursor += h;
    y += h + GAP;
  }
  return { rootY0, rootY1: rootY0 + rootH, l1 };
}

const { rootY0, rootY1, l1 } = layout();

const SAN_CLS = "font-mono font-semibold text-[13px] max-sm:text-[17px]";
const SUB_CLS = "font-mono text-[10.5px] max-sm:hidden";

function Label({ x, y0, y1, node }: { x: number; y0: number; y1: number; node: Node }) {
  const mid = (y0 + y1) / 2;
  // Drop the second line for nodes too short to hold two lines without crowding a neighbour.
  const two = y1 - y0 >= 22;
  return (
    <g>
      <text x={x} y={two ? mid - 1 : mid} dominantBaseline={two ? "auto" : "central"} className={SAN_CLS} style={{ fill: "var(--ink)" }}>
        {node.san}
      </text>
      {two && (
        <text x={x} y={mid + 11} className={SUB_CLS} style={{ fill: "var(--muted-foreground)" }}>
          {Math.round(node.score * 100)}% · {node.n}
        </text>
      )}
    </g>
  );
}

function Tree() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="block h-auto w-full" aria-hidden="true" focusable="false">
      {/* Ribbons */}
      <g>
        {l1.map((b) => (
          <g key={b.san}>
            <path d={band(X_ROOT + BAR, b.src0, b.src1, X_L1, b.y0, b.y1)} style={{ fill: scoreColour(b.score, 55) }} />
            {b.kids.map((k) => (
              <path
                key={k.san}
                d={band(X_L1 + BAR + LABEL_COL, k.src0, k.src1, X_L2, k.y0, k.y1)}
                style={{ fill: scoreColour(k.score, 55) }}
              />
            ))}
          </g>
        ))}
      </g>
      {/* Node bars */}
      <g>
        <rect x={X_ROOT} y={rootY0} width={BAR} height={rootY1 - rootY0} style={{ fill: "var(--tree-mid)" }} />
        {l1.map((b) => (
          <g key={b.san}>
            <rect x={X_L1} y={b.y0} width={BAR} height={b.y1 - b.y0} style={{ fill: scoreColour(b.score) }} />
            {b.kids.map((k) => (
              <rect key={k.san} x={X_L2} y={k.y0} width={BAR} height={k.y1 - k.y0} style={{ fill: scoreColour(k.score) }} />
            ))}
          </g>
        ))}
      </g>
      {/* Labels */}
      <text x={X_ROOT} y={14} className={SAN_CLS} style={{ fill: "var(--ink)" }}>
        1. e4
      </text>
      {l1.map((b) => (
        <g key={b.san}>
          <Label x={X_L1 + BAR + 8} y0={b.y0} y1={b.y1} node={b} />
          {b.kids.map((k) => (
            <Label key={k.san} x={X_L2 + BAR + 8} y0={k.y0} y1={k.y1} node={k} />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Hairline-framed "specimen plate": a static, decorative sketch of an opening tree. */
export function SpecimenPlate({ className }: { className?: string }) {
  return (
    <figure className={cn("border border-rule bg-card p-4 sm:p-5", className)} aria-hidden="true">
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-rule pb-2">
        <span className="label-caps text-sm">Plate I — 1. e4, {TOTAL} games</span>
        <span className="font-mono text-[10px] text-muted-foreground">No. 001</span>
      </div>
      <Tree />
      <figcaption className="mt-3 flex items-center justify-between gap-3 border-t border-rule pt-2 text-xs text-muted-foreground">
        <span className="font-serif italic">Ribbon width follows how often a move was played.</span>
        <span className="label-caps hidden shrink-0 sm:inline">Sample</span>
      </figcaption>
    </figure>
  );
}
