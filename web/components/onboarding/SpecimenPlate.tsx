import { cn } from "@/lib/utils";

type Tone = "low" | "mid" | "high";
type Leaf = { san: string; n: number; tone: Tone };
type Branch = { san: string; n: number; tone: Tone; kids: Leaf[] };

/** Hand-authored sample data: decorative only, not computed from anything. */
const SAMPLE: Branch[] = [
  { san: "1… c5", n: 14, tone: "mid", kids: [{ san: "2. Nf3", n: 10, tone: "mid" }, { san: "2. Nc3", n: 4, tone: "low" }] },
  { san: "1… e5", n: 12, tone: "high", kids: [{ san: "2. Nf3", n: 9, tone: "high" }, { san: "2. Bc4", n: 3, tone: "mid" }] },
  { san: "1… e6", n: 8, tone: "mid", kids: [{ san: "2. d4", n: 8, tone: "mid" }] },
  { san: "1… c6", n: 6, tone: "low", kids: [{ san: "2. d4", n: 6, tone: "low" }] },
];

const W = 440;
const H = 320;
const X0 = 54;
const X1 = 206;
const X2 = 352;
const SCALE = 0.62; // px of ribbon width per game
const GAP = 16;

function colour(t: Tone, pct = 62) {
  return `color-mix(in oklab, var(--tree-${t}) ${pct}%, transparent)`;
}

function ribbon(xa: number, ya: number, xb: number, yb: number) {
  const mx = (xa + xb) / 2;
  return `M${xa} ${ya} C${mx} ${ya} ${mx} ${yb} ${xb} ${yb}`;
}

function layout() {
  const total = SAMPLE.reduce((s, b) => s + b.n, 0);
  const span = total * SCALE + GAP * (SAMPLE.length - 1);
  let y = (H - span) / 2;
  const mids: { b: Branch; y: number; leaves: { l: Leaf; y: number }[] }[] = [];
  for (const b of SAMPLE) {
    const h = b.n * SCALE;
    const cy = y + h / 2;
    // Leaves stack inside the branch's own band so ribbons stay parallel.
    let ly = y;
    const leaves = b.kids.map((l) => {
      const lh = l.n * SCALE;
      const out = { l, y: ly + lh / 2 };
      ly += lh;
      return out;
    });
    mids.push({ b, y: cy, leaves });
    y += h + GAP;
  }
  return { total, mids };
}

const { total, mids } = layout();

function Tree() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true" focusable="false">
      <g fill="none" strokeLinecap="butt">
        {mids.map(({ b, y, leaves }) => (
          <g key={b.san}>
            <path d={ribbon(X0, H / 2, X1, y)} style={{ stroke: colour(b.tone) }} strokeWidth={b.n * SCALE} />
            {leaves.map(({ l, y: ly }) => (
              <path key={l.san} d={ribbon(X1, y, X2, ly)} style={{ stroke: colour(l.tone, 48) }} strokeWidth={l.n * SCALE} />
            ))}
          </g>
        ))}
      </g>
      <g className="font-mono" style={{ fontSize: 10, fill: "var(--muted-foreground)" }}>
        <text x={4} y={H / 2 + 3}>1. e4</text>
        {mids.map(({ b, y, leaves }) => (
          <g key={b.san}>
            <text x={X1 - 38} y={y - (b.n * SCALE) / 2 - 4}>{b.san}</text>
            {leaves.map(({ l, y: ly }) => (
              <text key={l.san} x={X2 + 10} y={ly + 3}>{l.san}</text>
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Hairline-framed "specimen plate": a static, decorative sketch of an opening tree. */
export function SpecimenPlate({ className }: { className?: string }) {
  return (
    <figure className={cn("border border-rule bg-card p-4 sm:p-5", className)} aria-hidden="true">
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-rule pb-2">
        <span className="label-caps text-sm">Plate I — 1. e4, {total} games</span>
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
