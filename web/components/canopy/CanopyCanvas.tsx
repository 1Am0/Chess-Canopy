"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { CanopyTree } from "@/lib/canopy/types";
import { canopyBox, layoutCanopy, type CanopyLayout } from "@/lib/canopy/layout";
import { buildHitIndex, type HitIndex } from "@/lib/canopy/hit-test";
import { placeLabels, type PlacedLabel } from "@/lib/canopy/labels";
import { renderOverlay, renderStatic, type Frame } from "@/lib/canopy/render";
import { findNode } from "@/lib/canopy/subtree";
import type { CanopyTheme } from "@/lib/canopy/theme";
import {
  IDENTITY,
  clampView,
  lerpView,
  panBy,
  revealNode,
  toScreen,
  toWorld,
  zoomAt,
  type View,
} from "@/lib/canopy/viewport";

export interface CanopyCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  /** Screen position of node `id` inside the canvas box, or null. */
  anchorOf: (id: number) => { x: number; y: number } | null;
}

export interface CanopyCanvasProps {
  tree: CanopyTree;
  theme: CanopyTheme;
  width: number;
  height: number;
  /** Stale or loading: drawn dimmed, no pointer interaction. */
  inert: boolean;
  /** Keyboard-focused node (mirrored with ring + reveal), or -1. */
  focusId: number;
  /** Node highlighted by a touch selection, or -1. */
  selectedId: number;
  /** Ids of the current redo line, root first. */
  lineIds: number[];
  reducedMotion: boolean;
  /** Extra space at the bottom that overlays cover (the touch selection card), CSS px. */
  coverBottom?: number;
  onHover: (id: number, anchor: { x: number; y: number } | null) => void;
  onActivate: (id: number, how: "mouse" | "touch") => void;
  onLayout?: (l: CanopyLayout | null) => void;
}

type Buf = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const ZOOM_STEP = 1.6;
const ANIM_MS = 180;
const FADE_MS = 160;
const DIM_MS = 120;
const SLOW_STATIC_MS = 8;
const SETTLE_MS = 90;
const DRAG_PX = 4;

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function makeBuf(): Buf {
  return typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
}

interface Engine {
  tree: CanopyTree;
  layout: CanopyLayout | null;
  hit: HitIndex | null;
  theme: CanopyTheme;
  w: number;
  h: number;
  dpr: number;
  view: View;
  anim: { from: View; to: View; t0: number } | null;
  hot: number;
  focus: number;
  selected: number;
  line: number[];
  dim: number;
  dimTarget: number;
  dimAt: number;
  reduced: boolean;
  inert: boolean;
  coverBottom: number;
  bufs: [Buf, Buf];
  cur: 0 | 1;
  /** The view the current buffer was rendered at; null = needs a render. */
  bufView: View | null;
  staticDirty: boolean;
  staticAt: number;
  lastStaticMs: number;
  fade: { t0: number; pending: boolean } | null;
  labels: PlacedLabel[];
  gesture: boolean;
  raf: number;
}

/**
 * The canvas: layout, the offscreen static layer, the overlay (hover path, focus ring, redo
 * line), wheel / drag / pinch zoom and pointer hit-testing. It owns no React state: everything
 * hot lives in one mutable engine object, and a single rAF loop repaints only when dirty.
 */
export const CanopyCanvas = forwardRef<CanopyCanvasHandle, CanopyCanvasProps>(function CanopyCanvas(props, ref) {
  const { tree, theme, width, height, inert, focusId, selectedId, lineIds, reducedMotion, coverBottom = 0, onHover, onActivate, onLayout } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eng = useRef<Engine | null>(null);
  const cb = useRef({ onHover, onActivate });
  useEffect(() => {
    cb.current = { onHover, onActivate };
  });

  const layout = useMemo(
    () => (width > 0 && height > 0 ? layoutCanopy(tree, canopyBox(width, Math.max(120, height - coverBottom))) : null),
    [tree, width, height, coverBottom],
  );
  const hit = useMemo(() => (layout ? buildHitIndex(layout) : null), [layout]);
  useEffect(() => {
    onLayout?.(layout);
  }, [layout, onLayout]);

  const measure = useMemo(() => {
    if (typeof document === "undefined") return () => 0;
    const c = document.createElement("canvas").getContext("2d");
    return (s: string) => {
      if (!c) return s.length * 6.5;
      c.font = `500 11px ${theme.mono}`;
      return c.measureText(s).width;
    };
  }, [theme.mono]);

  /** (Re)create the engine state the first time, then keep it in sync with the props. */
  if (!eng.current && typeof document !== "undefined") {
    eng.current = {
      tree,
      layout: null,
      hit: null,
      theme,
      w: 0,
      h: 0,
      dpr: 1,
      view: IDENTITY,
      anim: null,
      hot: -1,
      focus: -1,
      selected: -1,
      line: [],
      dim: 0,
      dimTarget: 0,
      dimAt: 0,
      reduced: false,
      inert: false,
      coverBottom: 0,
      bufs: [makeBuf(), makeBuf()],
      cur: 0,
      bufView: null,
      staticDirty: true,
      staticAt: 0,
      lastStaticMs: 0,
      fade: null,
      labels: [],
      gesture: false,
      raf: 0,
    };
  }

  const draw = useCallback(() => {
    const e = eng.current;
    const canvas = canvasRef.current;
    if (!e) return;
    e.raf = 0;
    if (!canvas || !e.layout || e.w <= 0 || e.h <= 0) return;
    const now = performance.now();
    let more = false;

    // View animation (zoom buttons, reveal).
    if (e.anim) {
      const t = Math.min(1, (now - e.anim.t0) / ANIM_MS);
      e.view = lerpView(e.anim.from, e.anim.to, ease(t));
      if (t >= 1) {
        e.view = e.anim.to;
        e.anim = null;
      } else more = true;
      e.staticDirty = true;
    }
    // Hover dim.
    if (e.dim !== e.dimTarget) {
      const step = e.reduced ? 1 : (now - e.dimAt) / DIM_MS;
      e.dim = e.dim < e.dimTarget ? Math.min(e.dimTarget, e.dim + step) : Math.max(e.dimTarget, e.dim - step);
      if (e.dim !== e.dimTarget) more = true;
    }
    e.dimAt = now;

    const frame = (): Frame => ({ tree: e.tree, layout: e.layout!, view: e.view, theme: e.theme, dpr: e.dpr, box: { width: e.w, height: e.h }, labels: e.labels });

    const moving = e.gesture || e.anim !== null;
    if (e.staticDirty || e.bufView === null) {
      const slow = e.lastStaticMs > SLOW_STATIC_MS && moving && e.bufView !== null;
      if (slow && now < e.staticAt) {
        more = true; // keep blitting the old buffer; re-render once the gesture settles
      } else if (slow && e.staticAt === 0) {
        e.staticAt = now + SETTLE_MS;
        more = true;
      } else {
        const t0 = performance.now();
        // After a re-root the first render goes to the other buffer; the old picture fades out.
        let idx: 0 | 1 = e.cur;
        if (e.fade?.pending) {
          idx = (1 - e.cur) as 0 | 1;
          e.fade.pending = false;
          e.fade.t0 = performance.now();
        }
        const buf = e.bufs[idx];
        const bw = Math.round(e.w * e.dpr);
        const bh = Math.round(e.h * e.dpr);
        if (buf.width !== bw || buf.height !== bh) {
          buf.width = bw;
          buf.height = bh;
        }
        const bctx = buf.getContext("2d") as Ctx2D | null;
        if (bctx) {
          e.labels = placeLabels(e.tree, e.layout, e.view, { width: e.w, height: e.h }, measure);
          renderStatic(bctx as CanvasRenderingContext2D, frame());
        }
        e.cur = idx;
        e.bufView = e.view;
        e.staticDirty = false;
        e.staticAt = 0;
        e.lastStaticMs = performance.now() - t0;
      }
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const blit = (buf: Buf, bv: View | null, alpha: number) => {
      ctx.globalAlpha = alpha;
      if (bv && (bv.k !== e.view.k || bv.tx !== e.view.tx || bv.ty !== e.view.ty)) {
        // Stand-in while a slow static layer catches up: scale and move the old buffer.
        const s = e.view.k / bv.k;
        ctx.setTransform(s, 0, 0, s, (e.view.tx - bv.tx * s) * e.dpr, (e.view.ty - bv.ty * s) * e.dpr);
      } else ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(buf as CanvasImageSource, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
    };
    const dimAlpha = 1 - 0.55 * e.dim;
    if (e.fade) {
      const p = Math.min(1, (now - e.fade.t0) / FADE_MS);
      blit(e.bufs[(1 - e.cur) as 0 | 1], null, (1 - p) * dimAlpha);
      blit(e.bufs[e.cur], e.bufView, p * dimAlpha);
      if (p >= 1) e.fade = null;
      else more = true;
    } else blit(e.bufs[e.cur], e.bufView, dimAlpha);

    renderOverlay(
      ctx,
      frame(),
      { hot: e.selected >= 0 ? e.selected : e.hot, focus: e.focus, line: e.line, dim: e.dim },
      measure,
    );
    if (more) schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure]);

  const schedule = useCallback(() => {
    const e = eng.current;
    if (!e || e.raf) return;
    e.raf = requestAnimationFrame(draw);
  }, [draw]);

  // Sync props into the engine, then repaint.
  useEffect(() => {
    const e = eng.current;
    if (!e) return;
    const rerooted = e.tree !== tree && (e.tree.path.join(" ") !== tree.path.join(" ") || e.tree.color !== tree.color);
    if (rerooted) {
      e.view = IDENTITY;
      e.anim = null;
      e.hot = -1;
      e.dimTarget = 0;
      e.dim = 0;
      if (!reducedMotion && e.bufView !== null) e.fade = { t0: performance.now(), pending: true };
      else e.fade = null;
    }
    const sizeChanged = e.w !== width || e.h !== height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    e.tree = tree;
    e.layout = layout;
    e.hit = hit;
    e.theme = theme;
    e.w = width;
    e.h = height;
    e.dpr = dpr;
    e.reduced = reducedMotion;
    e.inert = inert;
    e.coverBottom = coverBottom;
    e.focus = focusId;
    e.selected = selectedId;
    e.line = lineIds;
    if (sizeChanged) e.view = clampView(e.view, { width, height });
    if (rerooted && canvasRef.current) canvasRef.current.style.touchAction = "pan-y";
    const canvas = canvasRef.current;
    if (canvas) {
      const bw = Math.round(width * dpr);
      const bh = Math.round(height * dpr);
      if (canvas.width !== bw) canvas.width = bw;
      if (canvas.height !== bh) canvas.height = bh;
    }
    e.staticDirty = true;
    // Keyboard focus: bring the node into view.
    if (focusId >= 0 && layout && focusId < layout.n) {
      const v = revealNode(e.view, layout, focusId, { width, height: height - coverBottom }, 40);
      if (v !== e.view) {
        if (reducedMotion) e.view = v;
        else e.anim = { from: e.view, to: v, t0: performance.now() };
      }
    }
    schedule();
  }, [tree, layout, hit, theme, width, height, inert, focusId, selectedId, lineIds, reducedMotion, coverBottom, schedule]);

  // Repaint when the device pixel ratio changes (zoom, moving between screens).
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    const onChange = () => {
      const e = eng.current;
      if (!e) return;
      e.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = Math.round(e.w * e.dpr);
        canvas.height = Math.round(e.h * e.dpr);
      }
      e.staticDirty = true;
      schedule();
      watch();
    };
    const watch = () => {
      mq?.removeEventListener("change", onChange);
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      mq.addEventListener("change", onChange);
    };
    watch();
    return () => mq?.removeEventListener("change", onChange);
  }, [schedule]);

  useEffect(
    () => () => {
      const e = eng.current;
      if (e?.raf) cancelAnimationFrame(e.raf);
    },
    [],
  );

  const setView = useCallback(
    (to: View, animate: boolean) => {
      const e = eng.current;
      if (!e) return;
      const next = clampView(to, { width: e.w, height: e.h });
      if (animate && !e.reduced) e.anim = { from: e.view, to: next, t0: performance.now() };
      else {
        e.anim = null;
        e.view = next;
        e.staticDirty = true;
      }
      const c = canvasRef.current;
      if (c) c.style.touchAction = next.k > 1.001 ? "none" : "pan-y";
      schedule();
    },
    [schedule],
  );

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        const e = eng.current;
        if (e) setView(zoomAt(e.anim?.to ?? e.view, ZOOM_STEP, e.w / 2, e.h / 2, { width: e.w, height: e.h }), true);
      },
      zoomOut: () => {
        const e = eng.current;
        if (e) setView(zoomAt(e.anim?.to ?? e.view, 1 / ZOOM_STEP, e.w / 2, e.h / 2, { width: e.w, height: e.h }), true);
      },
      fit: () => setView(IDENTITY, true),
      anchorOf: (id) => {
        const e = eng.current;
        if (!e?.layout || id < 0 || id >= e.layout.n) return null;
        const [x, y] = toScreen(e.anim?.to ?? e.view, e.layout.x[id], e.layout.y[id]);
        return { x, y };
      },
    }),
    [setView],
  );

  // Pointer, wheel and pinch handling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
    let pinch: { d: number; view: View } | null = null;
    let moved = false;
    let lastHover = -2;
    const coarse = () => window.matchMedia("(pointer: coarse)").matches;
    const local = (ev: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    const pick = (x: number, y: number, touch: boolean): number => {
      const e = eng.current;
      if (!e?.hit) return -1;
      const [wx, wy] = toWorld(e.view, x, y);
      return e.hit.nearest(wx, wy, (touch || coarse() ? 18 : 10) / e.view.k);
    };
    const setHot = (id: number, x: number, y: number) => {
      const e = eng.current;
      if (!e) return;
      if (id === lastHover) return;
      lastHover = id;
      e.hot = id;
      e.dimTarget = id >= 0 ? 1 : 0;
      e.dimAt = performance.now();
      cb.current.onHover(id, id >= 0 ? { x, y } : null);
      schedule();
    };

    const onWheel = (ev: WheelEvent) => {
      const e = eng.current;
      if (!e || e.inert) return;
      ev.preventDefault();
      const { x, y } = local(ev);
      const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
      const factor = Math.exp(-dy * (ev.ctrlKey ? 0.01 : 0.0015));
      e.gesture = true;
      setView(zoomAt(e.view, factor, x, y, { width: e.w, height: e.h }), false);
      lastHover = -2;
      clearTimeout(settle);
      settle = setTimeout(() => {
        e.gesture = false;
        e.staticDirty = true;
        schedule();
      }, SETTLE_MS);
    };
    let settle: ReturnType<typeof setTimeout> | undefined;

    const onDown = (ev: PointerEvent) => {
      const e = eng.current;
      if (!e || e.inert) return;
      const { x, y } = local(ev);
      pointers.set(ev.pointerId, { x, y, sx: x, sy: y });
      if (pointers.size === 1) moved = false;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, view: e.view };
        moved = true;
      }
      try {
        canvas.setPointerCapture(ev.pointerId);
      } catch {
        /* not capturable */
      }
    };
    const onMove = (ev: PointerEvent) => {
      const e = eng.current;
      if (!e) return;
      const { x, y } = local(ev);
      const p = pointers.get(ev.pointerId);
      if (!p) {
        if (e.inert || ev.pointerType === "touch") return;
        setHot(pick(x, y, false), x, y);
        return;
      }
      if (e.inert) return;
      const dx = x - p.x;
      const dy = y - p.y;
      p.x = x;
      p.y = y;
      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        e.gesture = true;
        setView(zoomAt(pinch.view, d / pinch.d, mx, my, { width: e.w, height: e.h }), false);
        return;
      }
      if (!moved && Math.hypot(x - p.sx, y - p.sy) > DRAG_PX) moved = true;
      if (moved && e.view.k > 1.001) {
        e.gesture = true;
        setHot(-1, x, y);
        setView(panBy(e.view, dx, dy, { width: e.w, height: e.h }), false);
      }
    };
    const end = (ev: PointerEvent, cancelled: boolean) => {
      const e = eng.current;
      const p = pointers.get(ev.pointerId);
      pointers.delete(ev.pointerId);
      if (pointers.size < 2) pinch = null;
      if (e?.gesture && pointers.size === 0) {
        e.gesture = false;
        e.staticDirty = true;
        schedule();
      }
      if (!e || !p || cancelled || e.inert) return;
      if (!moved && pointers.size === 0) {
        const touch = ev.pointerType === "touch";
        const id = pick(p.sx, p.sy, touch);
        if (id >= 0) cb.current.onActivate(id, touch ? "touch" : "mouse");
        else if (touch) cb.current.onActivate(-1, "touch");
      }
    };
    const onUp = (ev: PointerEvent) => end(ev, false);
    const onCancel = (ev: PointerEvent) => end(ev, true);
    const onLeave = (ev: PointerEvent) => {
      if (ev.pointerType === "touch" || pointers.size) return;
      setHot(-1, 0, 0);
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      clearTimeout(settle);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [schedule, setView]);

  // The tree changed under the pointer: forget the hover.
  useEffect(() => {
    const e = eng.current;
    if (!e) return;
    e.hot = -1;
    e.dimTarget = 0;
    cb.current.onHover(-1, null);
  }, [tree]);

  // Test hook: client coordinates of the node reached by space-separated relative SANs.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    Object.defineProperty(canvas, "canopyPointOf", {
      configurable: true,
      enumerable: false,
      value: (rel: string): { x: number; y: number } | null => {
        const e = eng.current;
        if (!e?.layout) return null;
        const id = findNode(e.tree, rel.trim() === "" ? [] : rel.trim().split(/\s+/));
        if (id < 0) return null;
        const [sx, sy] = toScreen(e.view, e.layout.x[id], e.layout.y[id]);
        const r = canvas.getBoundingClientRect();
        return { x: r.left + sx, y: r.top + sy };
      },
    });
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="canopy-canvas"
      data-complete={tree.complete ? "true" : "false"}
      data-root={tree.path.join(" ")}
      data-nodes={tree.n}
      className="absolute inset-0 size-full touch-pan-y select-none"
      style={{ width, height, cursor: inert ? "default" : undefined }}
    />
  );
});
