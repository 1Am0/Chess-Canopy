import { BUNDLE, FRONTIER, LEAF, NODE, type CanopyTree } from "./types";
import type { CanopyLayout } from "./layout";
import type { CanopyTheme } from "./theme";
import { displayScore, rampIndex } from "./color";
import { moveTicks } from "./rows";
import { placeLabels, screenRadius, type PlacedLabel } from "./labels";
import { pathIds } from "./subtree";
import type { View } from "./viewport";

export interface Frame {
  tree: CanopyTree;
  layout: CanopyLayout;
  view: View;
  theme: CanopyTheme;
  dpr: number;
  box: { width: number; height: number };
  labels: PlacedLabel[];
}

/** Visual constants (section 5), exported so they can be audited. CSS px at k = 1 unless noted. */
export const CANOPY_STYLE = {
  guideWidth: 1,
  gutterLabelX: 30,
  gutterFontPx: 10,
  gutterFontWeight: 500,
  gutterMinTickGapPx: 14,
  groundWidth: 1,
  trunkWidth: 2.5,
  trunkAlpha: 0.9,
  rootRadius: 5,
  rootRingWidth: 1.5,
  rootRingAlpha: 0.85,
  branchWidthMin: 0.9,
  branchWidthSpan: 1.6,
  branchAlphaMin: 0.5,
  branchAlphaSpan: 0.4,
  stemWidth: 0.75,
  provisionalFactor: 0.7,
  discRadiusMin: 2.25,
  discRadiusSpan: 3.25,
  discStrokeWidth: 1,
  leafRadius: 2,
  hollowRingWidth: 1,
  hazeRadius: 5,
  labelFontPx: 11,
  labelFontWeight: 500,
  labelHaloWidth: 3,
  hotLineWidth: 2,
  hotUnderlayWidth: 4,
  hotRingOffset: 3,
  hotRingWidth: 2,
  focusRingOffset: 6,
  focusRingWidth: 2,
  currentLineWidth: 1.5,
  currentLineAlpha: 0.8,
  dimAlpha: 0.55,
  pathLabelMax: 12,
  cullAboveK: 1.5,
} as const;

const S = CANOPY_STYLE;

const tipHollow = (t: CanopyTree, i: number): boolean =>
  t.kind[i] === LEAF && t.leafLen[i] - t.rootPly > t.depthCap;

function snapY(y: number, dpr: number, widthCss: number): number {
  const w = Math.max(1, Math.round(widthCss * dpr));
  const off = w % 2 === 1 ? 0.5 : 0;
  return (Math.round(y * dpr - off) + off) / dpr;
}

function worldTransform(ctx: CanvasRenderingContext2D, f: Frame): void {
  const { dpr, view } = f;
  ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.tx, dpr * view.ty);
}
function screenTransform(ctx: CanvasRenderingContext2D, dpr: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Bézier with vertical tangents from (px,py) to (cx,cy). */
function edge(ctx: CanvasRenderingContext2D, px: number, py: number, cx: number, cy: number): void {
  const my = (py + cy) / 2;
  ctx.moveTo(px, py);
  ctx.bezierCurveTo(px, my, cx, my, cx, cy);
}

export function renderStatic(ctx: CanvasRenderingContext2D, f: Frame): void {
  const { tree: t, layout: l, view: v, theme: th, dpr, box } = f;
  const k = v.k;
  const n = t.n;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, Math.ceil(box.width * dpr), Math.ceil(box.height * dpr));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 1;

  // 1. Row guides and gutter labels (screen space; labels stay pinned to the left edge).
  screenTransform(ctx, dpr);
  const ticks = moveTicks(t.rootPly, l.rows, S.gutterMinTickGapPx / k);
  ctx.lineWidth = S.guideWidth;
  ctx.strokeStyle = th.guide;
  ctx.beginPath();
  const visibleTicks: Array<{ y: number; label: string; root: boolean }> = [];
  for (const tick of ticks) {
    const sy = l.rows.y(tick.depth) * k + v.ty;
    if (sy < -2 || sy > box.height + 2) continue;
    const y = snapY(sy, dpr, S.guideWidth);
    ctx.moveTo(S.gutterLabelX + 8, y);
    ctx.lineTo(box.width - 8, y);
    visibleTicks.push({ y: sy, label: tick.label, root: tick.depth === 0 });
  }
  ctx.stroke();
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = `${S.gutterFontWeight} ${S.gutterFontPx}px ${th.mono}`;
  visibleTicks.forEach((tk, idx) => {
    ctx.fillStyle = tk.root ? th.fg : th.muted;
    ctx.fillText(tk.label, S.gutterLabelX, tk.y);
    // The topmost visible numbered tick also carries the "move" caption above it.
    if (idx === visibleTicks.length - 1 && !tk.root) {
      ctx.font = `400 ${S.gutterFontPx}px ${th.sans}`;
      ctx.fillStyle = th.muted;
      ctx.fillText("move", S.gutterLabelX, tk.y - 12);
      ctx.font = `${S.gutterFontWeight} ${S.gutterFontPx}px ${th.mono}`;
    }
  });
  ctx.textAlign = "left";

  // 2. Ground line.
  const gy = l.groundY * k + v.ty;
  if (gy >= 0 && gy <= box.height) {
    const y = snapY(gy, dpr, S.groundWidth);
    ctx.lineWidth = S.groundWidth;
    ctx.strokeStyle = th.border ?? th.guide;
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(box.width - 8, y);
    ctx.stroke();
  }

  // 3. World space: trunk, stems, branches, haze, leaves, discs, root marker.
  worldTransform(ctx, f);
  const cull = k > S.cullAboveK;
  const m = 24;
  const inView = (ax: number, ay: number, bx: number, by: number): boolean => {
    if (!cull) return true;
    const x0 = Math.min(ax, bx) * k + v.tx;
    const x1 = Math.max(ax, bx) * k + v.tx;
    const y0 = Math.min(ay, by) * k + v.ty;
    const y1 = Math.max(ay, by) * k + v.ty;
    return x1 >= -m && x0 <= box.width + m && y1 >= -m && y0 <= box.height + m;
  };
  const pointIn = (x: number, y: number): boolean => inView(x, y, x, y);

  // Trunk.
  ctx.strokeStyle = th.branch;
  ctx.globalAlpha = S.trunkAlpha;
  ctx.lineWidth = S.trunkWidth / k;
  ctx.beginPath();
  ctx.moveTo(l.rootX, l.groundY);
  ctx.lineTo(l.x[0], l.y[0]);
  ctx.stroke();

  // Stems (single games): thin, one batched path per alpha.
  const batchStems = (provisional: boolean): void => {
    ctx.beginPath();
    let any = false;
    for (let i = 1; i < n; i++) {
      const kind = t.kind[i];
      if (kind !== LEAF && kind !== BUNDLE) continue;
      if ((kind === LEAF && t.san[i] === "") !== provisional) continue;
      if (!inView(l.bx[i], l.by[i], l.x[i], l.y[i])) continue;
      edge(ctx, l.bx[i], l.by[i], l.x[i], l.y[i]);
      any = true;
    }
    if (any) ctx.stroke();
  };
  ctx.lineWidth = S.stemWidth / k;
  ctx.globalAlpha = th.tailAlpha;
  batchStems(false);
  ctx.globalAlpha = th.tailAlpha * S.provisionalFactor;
  batchStems(true);

  // Multi-game branches, games ascending so the thick ones sit on top.
  const inner: number[] = [];
  for (let i = 1; i < n; i++) if (t.kind[i] === NODE || t.kind[i] === FRONTIER) inner.push(i);
  inner.sort((a, b) => t.games[a] - t.games[b] || a - b);
  const rootGames = Math.max(1, t.games[0]);
  for (const i of inner) {
    if (!inView(l.bx[i], l.by[i], l.x[i], l.y[i])) continue;
    const s = Math.min(1, t.games[i] / rootGames);
    ctx.globalAlpha = S.branchAlphaMin + S.branchAlphaSpan * Math.sqrt(s);
    ctx.lineWidth = l.w[i] / k;
    ctx.beginPath();
    edge(ctx, l.bx[i], l.by[i], l.x[i], l.y[i]);
    ctx.stroke();
  }

  // Leaf colour buckets (ramp index -> node ids).
  const ramp = th.ramp;
  const leafBuckets = new Map<number, number[]>();
  for (let i = 1; i < n; i++) {
    const kind = t.kind[i];
    if (kind !== LEAF && kind !== BUNDLE) continue;
    if (!pointIn(l.x[i], l.y[i])) continue;
    const c = rampIndex(ramp, displayScore(t, i));
    let b = leafBuckets.get(c);
    if (!b) leafBuckets.set(c, (b = []));
    b.push(i);
  }
  const rk = Math.pow(Math.min(k, 3), 0.4) / k; // world radius per CSS-px radius
  const arcs = (ids: number[], r: number, filter: (i: number) => boolean): boolean => {
    ctx.beginPath();
    let any = false;
    for (const i of ids) {
      if (!filter(i)) continue;
      ctx.moveTo(l.x[i] + r, l.y[i]);
      ctx.arc(l.x[i], l.y[i], r, 0, Math.PI * 2);
      any = true;
    }
    return any;
  };
  const isProv = (i: number): boolean => t.kind[i] === LEAF && t.san[i] === "";

  // Foliage haze.
  for (const [c, ids] of leafBuckets) {
    ctx.fillStyle = ramp[c];
    for (const prov of [false, true]) {
      ctx.globalAlpha = th.hazeAlpha * (prov ? S.provisionalFactor : 1);
      if (arcs(ids, S.hazeRadius * rk, (i) => isProv(i) === prov)) ctx.fill();
    }
  }
  // Leaves: solid tips, then hollow rings for tips clamped by the depth cap.
  for (const [c, ids] of leafBuckets) {
    ctx.fillStyle = ramp[c];
    ctx.strokeStyle = ramp[c];
    for (const prov of [false, true]) {
      ctx.globalAlpha = th.leafAlpha * (prov ? S.provisionalFactor : 1);
      if (arcs(ids, S.leafRadius * rk, (i) => isProv(i) === prov && !tipHollow(t, i))) ctx.fill();
    }
    ctx.lineWidth = S.hollowRingWidth / k;
    for (const prov of [false, true]) {
      ctx.globalAlpha = th.leafAlpha * (prov ? S.provisionalFactor : 1);
      if (arcs(ids, S.leafRadius * rk, (i) => isProv(i) === prov && tipHollow(t, i))) ctx.stroke();
    }
  }

  // Node discs, small first.
  ctx.globalAlpha = 1;
  ctx.strokeStyle = th.surface;
  ctx.lineWidth = S.discStrokeWidth / k;
  for (const i of inner) {
    if (!l.drawn[i] || !pointIn(l.x[i], l.y[i])) continue;
    ctx.fillStyle = ramp[rampIndex(ramp, displayScore(t, i))];
    ctx.beginPath();
    ctx.arc(l.x[i], l.y[i], l.r[i] * rk, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Root marker.
  {
    const r = S.rootRadius * rk;
    ctx.fillStyle = ramp[rampIndex(ramp, displayScore(t, 0))];
    ctx.beginPath();
    ctx.arc(l.x[0], l.y[0], r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = S.rootRingAlpha;
    ctx.strokeStyle = th.fg;
    ctx.lineWidth = S.rootRingWidth / k;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 4. Labels, crisp in screen space.
  screenTransform(ctx, dpr);
  ctx.font = `${S.labelFontWeight} ${S.labelFontPx}px ${th.mono}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = th.surface;
  ctx.lineWidth = S.labelHaloWidth;
  ctx.fillStyle = th.fg;
  for (const lb of f.labels) {
    const y = lb.y + lb.h / 2 + 0.5;
    ctx.strokeText(lb.text, lb.x, y);
    ctx.fillText(lb.text, lb.x, y);
  }
  ctx.globalAlpha = 1;
}

export interface Overlay {
  /** Hovered node, or -1. */
  hot: number;
  /** Keyboard-focused node, or -1. */
  focus: number;
  /** Ids of the current redo line in the tree (root first); empty when absent. */
  line: number[];
  /** 0..1: how far the static layer is dimmed (alpha = 1 - 0.55 * dim). */
  dim: number;
  /**
   * The static buffer. When given, the visible canvas is cleared and the buffer is blitted at the
   * dimmed alpha before the overlay is drawn; when omitted the caller has already blitted.
   */
  base?: CanvasImageSource | null;
}

function pathStroke(ctx: CanvasRenderingContext2D, l: CanopyLayout, ids: readonly number[]): void {
  ctx.beginPath();
  for (let j = 1; j < ids.length; j++) {
    const p = ids[j - 1];
    const c = ids[j];
    edge(ctx, l.x[p], l.y[p], l.x[c], l.y[c]);
  }
  ctx.stroke();
}

export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  o: Overlay,
  measure: (s: string) => number,
): void {
  const { tree: t, layout: l, view: v, theme: th, dpr, box } = f;
  const k = v.k;

  if (o.base) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, Math.ceil(box.width * dpr), Math.ceil(box.height * dpr));
    ctx.globalAlpha = 1 - S.dimAlpha * Math.min(1, Math.max(0, o.dim));
    ctx.drawImage(o.base, 0, 0);
    ctx.globalAlpha = 1;
  }

  worldTransform(ctx, f);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Current redo line: always on, not dimmed.
  if (o.line.length > 1) {
    ctx.globalAlpha = S.currentLineAlpha;
    ctx.strokeStyle = th.line;
    ctx.lineWidth = S.currentLineWidth / k;
    pathStroke(ctx, l, o.line);
    ctx.globalAlpha = 1;
  }

  const target = o.hot >= 0 ? o.hot : o.focus;
  let ids: number[] = [];
  if (target >= 0 && target < t.n) {
    ids = pathIds(t, target);
    if (ids.length > 1) {
      ctx.strokeStyle = th.surface;
      ctx.lineWidth = S.hotUnderlayWidth / k;
      pathStroke(ctx, l, ids);
      ctx.strokeStyle = th.hot;
      ctx.lineWidth = S.hotLineWidth / k;
      pathStroke(ctx, l, ids);
    }
    const rs = screenRadius(Math.max(l.r[target], S.leafRadius), k);
    ctx.strokeStyle = th.hot;
    ctx.lineWidth = S.hotRingWidth / k;
    ctx.beginPath();
    ctx.arc(l.x[target], l.y[target], (rs + S.hotRingOffset) / k, 0, Math.PI * 2);
    ctx.stroke();
    if (o.focus >= 0 && o.focus < t.n) {
      const fr = screenRadius(Math.max(l.r[o.focus], S.leafRadius), k);
      ctx.strokeStyle = th.ring;
      ctx.lineWidth = S.focusRingWidth / k;
      ctx.beginPath();
      ctx.arc(l.x[o.focus], l.y[o.focus], (fr + S.focusRingOffset) / k, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Path labels (root upward), colliding with the static labels but never repeating them.
  if (ids.length > 1) {
    const placed = placeLabels(t, l, v, box, measure, {
      hot: ids,
      hotOnly: true,
      hotMax: S.pathLabelMax,
      reserved: f.labels,
    });
    if (placed.length) {
      screenTransform(ctx, dpr);
      ctx.font = `${S.labelFontWeight} ${S.labelFontPx}px ${th.mono}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.lineWidth = S.labelHaloWidth;
      ctx.strokeStyle = th.surface;
      ctx.fillStyle = th.fg;
      for (const lb of placed) {
        const y = lb.y + lb.h / 2 + 0.5;
        ctx.strokeText(lb.text, lb.x, y);
        ctx.fillText(lb.text, lb.x, y);
      }
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}
