"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Color, TreeNode } from "@/lib/engine/types";
import { getExplorer, isExplorerRestart } from "@/lib/explorer-client";
import { compact, pct, score } from "@/lib/format";
import { useExplorerStore } from "@/lib/store";
import { usePosition } from "@/hooks/use-position";
import { EmptySpecimen, Kicker } from "@/components/field";
import { cn } from "@/lib/utils";

const DEPTHS = [2, 3, 4] as const;
const BREADTH = 4;
const NODE_W = 5;
const MIN_H = 14;
const GAP = 4;
const PAD_T = 36;
const PAD_B = 12;
/** Left gutter that holds the root's own label. */
const PAD_L = 62;
const PAD_L_NARROW = 10;
/** Score at which the scale is fully "low" / "high" (0.5 is the middle). */
const SPREAD = 0.15;
/** Node heights that still fit a one-line / two-line label. */
const H_ONE = 12;
const H_TWO = 26;

/** Diverging OKLCH colour for a score in [0, 1]; the tokens are defined in the theme. */
export function scoreColor(sc: number): string {
  const d = Math.max(-1, Math.min(1, (sc - 0.5) / SPREAD));
  const mid = "var(--tree-mid, #cfc6ad)";
  if (d >= 0) return `color-mix(in oklch, var(--tree-high, #3f8a7a) ${Math.round(d * 100)}%, ${mid})`;
  return `color-mix(in oklch, var(--tree-low, #c0782f) ${Math.round(-d * 100)}%, ${mid})`;
}

/** "3. Nf3" for a White ply, "3… c5" for a Black ply; `ply` is the 0-based index of the move. */
export function moveLabel(san: string, ply: number): string {
  const n = Math.floor(ply / 2) + 1;
  return ply % 2 === 0 ? `${n}. ${san}` : `${n}… ${san}`;
}

interface Placed {
  node: TreeNode;
  id: string;
  level: number;
  parent: Placed | null;
  /** Position among its level's nodes (depth-first, so ribbons never cross) */
  x: number;
  y: number;
  h: number;
  /** Where the ribbon from the parent starts */
  srcY: number;
  w: number;
  sc: number;
}

function layout(root: TreeNode, W: number, H: number) {
  const all: Placed[][] = [];
  const walk = (n: TreeNode, level: number, parent: Placed | null) => {
    const p: Placed = { node: n, id: n.path.join(" "), level, parent, x: 0, y: 0, h: 0, srcY: 0, w: 0, sc: score(n.stats) };
    (all[level] ??= []).push(p);
    for (const c of n.children) walk(c, level + 1, p);
  };
  walk(root, 0, null);
  const levels = all.length - 1;
  const availH = Math.max(40, H - PAD_T - PAD_B);
  const heightAt = (s: number, col: Placed[]) => col.reduce((a, p) => a + Math.max(MIN_H, p.node.stats.total * s), 0) + GAP * (col.length - 1);
  let lo = 0;
  let hi = availH / Math.max(1, root.stats.total);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (all.every((col) => heightAt(mid, col) <= availH)) lo = mid;
    else hi = mid;
  }
  const s = lo;
  const padL = W >= 360 ? PAD_L : PAD_L_NARROW;
  // Each non-root node owns a clear slot to the right of its bar for its tag; ribbons leave after it.
  // The last column's slot doubles as the right-hand gutter, so labels never reach the panel edge.
  const labelW = Math.max(44, Math.min(78, ((W - padL) / (levels + 1)) * 0.4));
  const pitch = levels > 0 ? Math.max(20, (W - padL - NODE_W - labelW - 6) / levels) : 0;
  all.forEach((col, level) => {
    let y = PAD_T + (availH - heightAt(s, col)) / 2;
    for (const p of col) {
      p.x = padL + level * pitch;
      p.h = Math.max(MIN_H, p.node.stats.total * s);
      p.w = Math.max(1.5, p.node.stats.total * s);
      p.y = y;
      y += p.h + GAP;
    }
  });
  for (const col of all) {
    const used = new Map<Placed, number>();
    for (const p of col) {
      if (!p.parent) continue;
      const acc = used.get(p.parent) ?? 0;
      used.set(p.parent, acc + p.w);
      p.srcY = Math.min(p.parent.y + p.parent.h - p.w / 2, Math.max(p.parent.y + p.w / 2, p.parent.y + acc + p.w / 2));
    }
  }
  return { all, nodes: all.flat(), s, labelW, padL, pitch, w: W };
}

function nodeAria(p: Placed, side: Color): string {
  const n = p.node;
  const where = p.level === 0 ? "" : `${moveLabel(n.san ?? "", n.path.length - 1)}: `;
  const games = `${n.stats.total} ${n.stats.total === 1 ? "game" : "games"}`;
  return `${where}${games}, score ${pct(p.sc)} as ${side === "white" ? "White" : "Black"}`;
}

export function CanopyTree({ active }: { active: boolean }) {
  const { visible, key } = usePosition();
  const ready = useExplorerStore((s) => s.ready);
  const selectionVersion = useExplorerStore((s) => s.selectionVersion);
  const hasPlayers = useExplorerStore((s) => s.players.length > 0);
  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const setLine = useExplorerStore((s) => s.setLine);
  const setHoverMove = useExplorerStore((s) => s.setHoverMove);

  const [depth, setDepth] = useState<number>(3);
  const [data, setData] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const setHoverRef = useRef(setHoverMove);
  setHoverRef.current = setHoverMove;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) });
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Only query while the tab is showing; the previous tree stays (dimmed) until the new one lands.
  useEffect(() => {
    if (!active || !ready || selectionVersion === 0 || !hasPlayers) return;
    let cancelled = false;
    setLoading(true);
    getExplorer()
      .tree(visibleRef.current, { depth, breadth: BREADTH, minGames: 1 })
      .then((t) => {
        if (cancelled) return;
        setData(t);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoading(false);
        if (isExplorerRestart(e)) return; // re-applied after the restart
        // Invalid lines are handled by the position query; the tree just keeps its last state.
      });
    return () => {
      cancelled = true;
    };
  }, [active, ready, selectionVersion, hasPlayers, key, depth]);

  // The hover arrow belongs to this tab: drop it when the tab is left.
  useEffect(() => {
    if (!active) setHover(null);
  }, [active]);
  useEffect(() => {
    if (!active) return;
    return () => setHoverRef.current(null);
  }, [active]);

  const tree = hasPlayers ? data : null;
  const lay = useMemo(() => (tree && size.w > 0 && size.h > 0 ? layout(tree, size.w, size.h) : null), [tree, size.w, size.h]);
  const empty = !loading && (!tree || tree.children.length === 0);

  const hoverNode = useCallback(
    (p: Placed | null) => {
      setHover(p ? p.id : null);
      if (!p) return setHoverMove(null);
      const base = visibleRef.current.length;
      // The board arrow previews the first ply of the branch under the pointer.
      setHoverMove(p.node.path.length > base ? p.node.path[base] : null);
    },
    [setHoverMove],
  );

  const onKey = (e: React.KeyboardEvent, p: Placed) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      setLine(p.node.path);
      return;
    }
    let target: Placed | undefined;
    const col = lay?.all[p.level] ?? [];
    const at = col.indexOf(p);
    if (e.key === "ArrowRight") target = lay?.all[p.level + 1]?.find((q) => q.parent === p);
    else if (e.key === "ArrowLeft") target = p.parent && p.parent.level > 0 ? p.parent : undefined;
    else if (e.key === "ArrowDown") target = col[at + 1];
    else if (e.key === "ArrowUp") target = col[at - 1];
    else return;
    // The line shortcuts use the same keys: keep them for the tree while a node has focus.
    e.preventDefault();
    e.stopPropagation();
    if (target) boxRef.current?.querySelector<SVGGElement>(`[data-node="${CSS.escape(target.id)}"]`)?.focus();
  };

  const rootLabel = visible.length ? moveLabel(visible[visible.length - 1], visible.length - 1) : "Start";

  return (
    <div ref={boxRef} data-local-keys className="relative h-full w-full overflow-hidden" data-testid="canopy-tree">
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${Math.max(size.w, 1)} ${Math.max(size.h, 1)}`}
        role="group"
        aria-label="Opening tree: branch width is games, colour is your score"
        className={cn("absolute inset-0 transition-opacity duration-150 motion-reduce:transition-none", loading ? "opacity-50" : "opacity-100")}
      >
        {lay && !empty && (
          <>
            <g fill="none">
              {lay.nodes.map((p) => {
                if (!p.parent) return null;
                const x1 = p.parent.x + NODE_W + (p.parent.level === 0 ? 0 : lay.labelW);
                const x2 = p.x;
                const xm = (x1 + x2) / 2;
                const y2 = p.y + p.h / 2;
                const on = hover === null || (hover + " ").startsWith(p.id + " ");
                return (
                  <path
                    key={p.id}
                    d={`M${x1},${p.srcY} C${xm},${p.srcY} ${xm},${y2} ${x2},${y2}`}
                    strokeWidth={p.w}
                    style={{ stroke: scoreColor(p.sc), opacity: hover === null ? 0.5 : on ? 1 : 0.2 }}
                    className="transition-opacity duration-150 motion-reduce:transition-none"
                  />
                );
              })}
            </g>
            {lay.nodes.map((p) => {
              const root = p.level === 0;
              const on = hover === null || (hover + " ").startsWith(p.id + " ");
              const label = root ? rootLabel : moveLabel(p.node.san ?? "", p.node.path.length - 1);
              const aria = nodeAria(p, side);
              const cy = p.y + p.h / 2;
              const two = p.h >= H_TWO;
              const showLabel = p.h >= H_ONE;
              const games = p.node.stats.total;
              const long = lay.labelW >= 70;
              const stats = `${pct(p.sc)} · ${compact(games)}${long ? (games === 1 ? " game" : " games") : ""}`;
              const other = p.node.otherGames ?? 0;
              const stubX = p.x + NODE_W + (root ? 0 : lay.labelW) + 2;
              const stubRoom = (p.level < lay.all.length - 1 ? p.x + lay.pitch : lay.w) - stubX;
              return (
                <g
                  key={p.id}
                  data-node={p.id}
                  role={root ? "img" : "button"}
                  tabIndex={root ? undefined : 0}
                  aria-label={aria}
                  className={cn("group outline-none", !root && "cursor-pointer", "transition-opacity duration-150 motion-reduce:transition-none")}
                  style={{ opacity: on ? 1 : 0.25 }}
                  onClick={root ? undefined : () => setLine(p.node.path)}
                  onKeyDown={root ? undefined : (e) => onKey(e, p)}
                  onPointerEnter={root ? undefined : () => hoverNode(p)}
                  onPointerLeave={root ? undefined : () => hoverNode(null)}
                  onFocus={root ? undefined : () => hoverNode(p)}
                  onBlur={root ? undefined : () => hoverNode(null)}
                >
                  <title>{aria}</title>
                  {!root && (
                    <>
                      <rect x={p.x - 3} y={p.y - 2} width={NODE_W + lay.labelW + 3} height={p.h + 4} rx={2} className="fill-transparent" />
                      <rect
                        x={p.x - 3}
                        y={p.y - 2}
                        width={NODE_W + lay.labelW + 3}
                        height={p.h + 4}
                        rx={2}
                        className="fill-none stroke-ring stroke-2 opacity-0 group-focus-visible:opacity-100"
                      />
                    </>
                  )}
                  <rect x={p.x} y={p.y} width={NODE_W} height={p.h} rx={1} style={{ fill: root ? "var(--ink)" : scoreColor(p.sc) }} />
                  {root && lay.padL >= PAD_L && (
                    <text x={p.x - 7} textAnchor="end" y={cy - 1} className="font-serif" style={{ fontSize: 13, fontStyle: "italic", fill: "var(--ink)" }}>
                      {label}
                      <tspan x={p.x - 7} dy={13} className="font-sans" style={{ fontSize: 10, fontStyle: "normal", fontVariantNumeric: "tabular-nums", fill: "var(--muted-foreground)" }}>
                        {compact(games)} {games === 1 ? "game" : "games"}
                      </tspan>
                    </text>
                  )}
                  {!root && showLabel && (
                    <>
                      <text
                        x={p.x + NODE_W + 6}
                        y={two ? cy - 2 : cy}
                        dominantBaseline={two ? "auto" : "central"}
                        className="font-mono"
                        style={{ fontSize: 11, fontWeight: 600, fill: "var(--ink)" }}
                      >
                        {label}
                      </text>
                      {two && (
                        <text
                          x={p.x + NODE_W + 6}
                          y={cy + 11}
                          className="font-sans"
                          style={{ fontSize: 10, fontVariantNumeric: "tabular-nums", fill: "var(--muted-foreground)" }}
                        >
                          {stats}
                        </text>
                      )}
                    </>
                  )}
                  {other > 0 && stubRoom >= 12 && (
                    <>
                      <line
                        x1={stubX}
                        x2={stubX + 12}
                        y1={p.y + p.h - 1}
                        y2={p.y + p.h - 1}
                        strokeDasharray="2 2"
                        strokeWidth={1}
                        style={{ stroke: "var(--rule-strong)" }}
                      />
                      {stubRoom >= 64 && (
                        <text x={stubX + 16} y={p.y + p.h - 1} dominantBaseline="central" className="font-sans" style={{ fontSize: 9, fill: "var(--muted-foreground)" }}>
                          +{compact(other)} other
                        </text>
                      )}
                    </>
                  )}
                </g>
              );
            })}
          </>
        )}
      </svg>
      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <EmptySpecimen
            className="py-2"
            title="No specimens collected here"
            hint={hasPlayers ? "No games continue from this position." : "Add games to see your opening tree."}
          />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-2 top-1.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5 text-[11px]">
          <Kicker as="span" className="mb-0">width = games · colour = your score</Kicker>
          <span className="flex items-center gap-1.5 text-muted-foreground tabular-nums" aria-hidden="true">
            <span>{`≤${pct(0.5 - SPREAD)}`}</span>
            <span
              className="h-1.5 w-14 rounded-[1px] border border-rule"
              style={{ background: "linear-gradient(to right, var(--tree-low), var(--tree-mid), var(--tree-high))" }}
            />
            <span>{`≥${pct(0.5 + SPREAD)}`}</span>
          </span>
        </div>
        <div role="group" aria-label="Tree depth" className="pointer-events-auto flex shrink-0 items-center gap-1.5 text-[11px]">
          <Kicker as="span" className="mb-0" aria-hidden="true">
            Plies
          </Kicker>
          <div className="flex items-center gap-px border border-rule-strong bg-rule-strong">
            {DEPTHS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={depth === d}
                aria-label={`Show ${d} plies`}
                onClick={() => setDepth(d)}
                className={cn(
                  "h-6 min-w-6 px-1.5 font-mono tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  depth === d ? "bg-card text-ink shadow-[inset_0_2px_0_var(--color-primary)]" : "bg-specimen text-muted-foreground hover:text-foreground",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
