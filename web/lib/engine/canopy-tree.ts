/**
 * Canopy tree: a budgeted, best-first expansion of the shared GameIndex below one position
 * (`growCanopy`) and a pure flat snapshot of what is expanded (`snapshotCanopy`).
 * Keys, stats and order come from `GameIndex.children`, so they are exactly the move table's.
 */
import type { Chess } from "chess.js";
import { ROOT, NODE, FRONTIER, LEAF, BUNDLE, type CanopyTree } from "@/lib/canopy/types";
import { compareCodePoints, classifyResult } from "./trie";
import { GameIndex, type IndexNode } from "./position-index";
import type { Color } from "./types";

export interface GrowOptions {
  /** Stop after this many ms of work (checked between node expansions). */
  budgetMs: number;
  /** Plies below the root to expand; deeper shared nodes stay FRONTIER. Default 160. */
  maxExpandDepth?: number;
  /** Yield to the worker's message loop every N ms (default 8) so query() is never blocked longer. */
  sliceMs?: number;
  /** Cancellation (newer seq): checked at every yield. */
  shouldStop?: () => boolean;
  now?: () => number;
  yieldFn?: () => Promise<void>;
}

export interface SnapshotOptions {
  key: string;
  path: string[];
  color: Color;
  selectionGames: number;
  maxDepth?: number;
  maxNodes?: number;
  maxLeaves?: number;
}

const DEFAULT_EXPAND_DEPTH = 160;

// Position bookkeeping shared by every grow call on the same nodes (an IndexNode is one
// move sequence, hence one position).
const fenMemo = new WeakMap<IndexNode, string>();
const lineage = new WeakMap<IndexNode, { parent: IndexNode; san: string }>();

function defaultYield(): Promise<void> {
  if (typeof MessageChannel !== "undefined") {
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        ch.port1.close();
        resolve();
      };
      ch.port2.postMessage(0);
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface HeapEntry {
  node: IndexNode;
  depth: number; // absolute ply
  games: number;
  order: number;
}

class MaxHeap {
  private a: HeapEntry[] = [];
  get size() {
    return this.a.length;
  }
  private less(x: HeapEntry, y: HeapEntry) {
    return x.games > y.games || (x.games === y.games && x.order < y.order);
  }
  push(e: HeapEntry) {
    const a = this.a;
    let i = a.length;
    a.push(e);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): HeapEntry | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Best-first (most games first) expansion of the subtree under `root`. Returns true when no
 * node with >= 2 games and relative depth < maxExpandDepth is left unexpanded.
 */
export async function growCanopy(
  index: GameIndex,
  root: IndexNode,
  rootFen: string,
  rootDepth: number,
  board: Chess,
  opts: GrowOptions,
): Promise<boolean> {
  const now = opts.now ?? (() => performance.now());
  const maxRel = opts.maxExpandDepth ?? DEFAULT_EXPAND_DEPTH;
  const sliceMs = opts.sliceMs ?? 8;
  const yieldFn = opts.yieldFn ?? defaultYield;
  const legal = index.legal;
  const t0 = now();
  let sliceStart = t0;
  let order = 0;
  const heap = new MaxHeap();

  fenMemo.set(root, rootFen);
  let boardFen: string | null = null;

  const fenOf = (node: IndexNode): string => {
    const hit = fenMemo.get(node);
    if (hit !== undefined) return hit;
    const lin = lineage.get(node);
    if (!lin) throw new Error("canopy: node has no known position");
    const pf = fenOf(lin.parent);
    if (boardFen !== pf) board.load(pf, { skipValidation: true });
    board.move(lin.san);
    const f = board.fen();
    fenMemo.set(node, f);
    boardFen = f;
    return f;
  };

  let current: IndexNode = root;
  const boardAt = (): Chess => {
    const f = fenOf(current);
    if (boardFen !== f) {
      board.load(f, { skipValidation: true });
      boardFen = f;
    }
    return board;
  };

  const consider = (parent: IndexNode, san: string, child: IndexNode, depth: number) => {
    if (child.idx.length < 2) return;
    if (legal && !lineage.has(child)) lineage.set(child, { parent, san });
    if (child.children) {
      walk(child, depth);
    } else if (depth - rootDepth < maxRel) {
      heap.push({ node: child, depth, games: child.idx.length, order: order++ });
    }
  };
  // Pre-order walk over the part that is already expanded (earlier rounds, queries).
  const walk = (node: IndexNode, depth: number) => {
    const kids = node.children;
    if (!kids) return;
    for (const [san, child] of kids) consider(node, san, child, depth + 1);
  };

  const expand = (node: IndexNode, depth: number) => {
    current = node;
    const kids = index.children(node, depth, boardAt);
    for (const [san, child] of kids) consider(node, san, child, depth + 1);
  };

  // The root is always expanded: its children are the move table.
  if (root.idx.length > 0) {
    if (root.children) walk(root, rootDepth);
    else expand(root, rootDepth);
  }

  for (;;) {
    if (heap.size === 0) return true;
    const t = now();
    if (t - t0 >= opts.budgetMs) return false;
    if (t - sliceStart >= sliceMs) {
      await yieldFn();
      if (opts.shouldStop?.()) return false;
      sliceStart = now();
    }
    const e = heap.pop()!;
    if (e.node.children) continue;
    expand(e.node, e.depth);
  }
}

// ---------------------------------------------------------------------------------------

interface Kid {
  san: string;
  node: IndexNode | null; // null: provisional leaf
  ref: number; // game index (leaves)
}

/** Children of an emitted node: inner (>= 2 games) first, then leaves, in table order. */
function kidsOf(children: Map<string, IndexNode>): { inner: Array<[string, IndexNode]>; leaves: Kid[] } {
  const inner: Array<[string, IndexNode]> = [];
  const leaves: Kid[] = [];
  for (const [san, child] of children) {
    if (child.idx.length >= 2) inner.push([san, child]);
    else leaves.push({ san, node: child, ref: child.idx[0] });
  }
  inner.sort((a, b) => b[1].idx.length - a[1].idx.length || compareCodePoints(b[0], a[0]));
  leaves.sort((a, b) => compareCodePoints(b.san, a.san));
  return { inner, leaves };
}

/** Provisional leaves: one per game that continues past `depth` (absolute). */
function provisional(index: GameIndex, node: IndexNode, depth: number): Kid[] {
  const out: Kid[] = [];
  for (let k = 0; k < node.idx.length; k++) {
    const ref = node.idx[k];
    if (index.games[ref].moves.length > depth) out.push({ san: "", node: null, ref });
  }
  return out;
}

function kindOfGame(index: GameIndex, ref: number): "win" | "loss" | "draw" {
  return classifyResult(index.games[ref].result ?? "*") ?? "draw";
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  return s[(s.length - 1) >> 1];
}

/** Pure read of what is expanded under `root`. */
export function snapshotCanopy(index: GameIndex, root: IndexNode, rootDepth: number, opts: SnapshotOptions): CanopyTree {
  const maxNodes = opts.maxNodes ?? 20_000;
  const maxLeaves = opts.maxLeaves ?? 15_000;
  const rootPly = rootDepth;
  const games = index.games;
  const tipOf = (ref: number) => games[ref].moves.length - rootPly;

  // ---- phase 1: depth cap ----
  let cap = opts.maxDepth ?? 0;
  if (opts.maxDepth === undefined) {
    const tips: number[] = [];
    let deepest = 0;
    const stack: Array<{ node: IndexNode; d: number }> = [{ node: root, d: 0 }];
    while (stack.length) {
      const { node, d } = stack.pop()!;
      if (d > deepest) deepest = d;
      const abs = rootPly + d;
      if (node.children) {
        for (const child of node.children.values()) {
          if (child.idx.length >= 2) stack.push({ node: child, d: d + 1 });
          else tips.push(tipOf(child.idx[0]));
        }
      } else if (node.idx.length > 0) {
        for (const k of provisional(index, node, abs)) tips.push(tipOf(k.ref));
      }
    }
    if (tips.length > 0) {
      tips.sort((a, b) => a - b);
      const p95 = tips[Math.min(tips.length - 1, Math.ceil(0.95 * tips.length) - 1)];
      cap = Math.min(120, Math.max(16, Math.ceil(p95)));
    } else {
      cap = Math.max(16, deepest + 4);
    }
  }
  cap = Math.max(0, cap);

  // ---- phase 2: BFS build ----
  const kind: number[] = [ROOT];
  const parent: number[] = [-1];
  const firstChild: number[] = [-1];
  const childCount: number[] = [0];
  const depth: number[] = [0];
  const branchDepth: number[] = [0];
  const san: string[] = [""];
  const nGames: number[] = [root.idx.length];
  const wins: number[] = [root.wins];
  const draws: number[] = [root.draws];
  const losses: number[] = [root.losses];
  const ended: number[] = [0];
  const leafRef: number[] = [-1];
  const leafLen: number[] = [0];
  const refs: Array<IndexNode | null> = [root];

  let innerCount = 1;
  let leavesLeft = maxLeaves;
  let capped = false;
  let complete = true;

  const push = (k: number, p: number, s: string, node: IndexNode | null, d: number, bd: number, g: number, w: number, dr: number, l: number, lref: number, llen: number) => {
    kind.push(k);
    parent.push(p);
    firstChild.push(-1);
    childCount.push(0);
    depth.push(d);
    branchDepth.push(bd);
    san.push(s);
    nGames.push(g);
    wins.push(w);
    draws.push(dr);
    losses.push(l);
    ended.push(0);
    leafRef.push(lref);
    leafLen.push(llen);
    refs.push(node);
  };

  for (let p = 0; p < kind.length; p++) {
    const k = kind[p];
    if (k !== ROOT && k !== NODE && k !== FRONTIER) continue;
    const node = refs[p]!;
    const dp = depth[p];
    if (dp >= cap) continue;
    const abs = rootPly + dp;
    let inner: Array<[string, IndexNode]> = [];
    let leaves: Kid[];
    if (node.children !== null && k !== FRONTIER) {
      const r = kidsOf(node.children);
      inner = r.inner;
      leaves = r.leaves;
    } else {
      leaves = provisional(index, node, abs);
    }
    const first = kind.length;
    for (const [s, child] of inner) {
      const isNode = child.children !== null && innerCount < maxNodes;
      innerCount++;
      if (!isNode) complete = false;
      push(isNode ? NODE : FRONTIER, p, s, child, dp + 1, dp + 1, child.idx.length, child.wins, child.draws, child.losses, -1, 0);
    }
    // leaves, within the leaf budget; the rest of this parent's leaves become one BUNDLE
    let keep = leaves.length;
    if (leaves.length > leavesLeft) {
      keep = leavesLeft;
      if (leaves.length - keep === 1) keep++;
    }
    leavesLeft = Math.max(0, leavesLeft - keep);
    const leafPush = (kid: Kid) => {
      const kg = kindOfGame(index, kid.ref);
      const len = games[kid.ref].moves.length;
      const tip = Math.min(Math.max(len - rootPly, dp + 1), cap);
      push(LEAF, p, kid.san, null, tip, dp + 1, 1, kg === "win" ? 1 : 0, kg === "draw" ? 1 : 0, kg === "loss" ? 1 : 0, kid.ref, len);
    };
    for (let i = 0; i < keep; i++) leafPush(leaves[i]);
    if (keep < leaves.length) {
      capped = true;
      const rest = leaves.slice(keep);
      let w = 0;
      let dr = 0;
      let l = 0;
      const lens: number[] = [];
      for (const kid of rest) {
        const kg = kindOfGame(index, kid.ref);
        if (kg === "win") w++;
        else if (kg === "draw") dr++;
        else l++;
        lens.push(games[kid.ref].moves.length);
      }
      const med = median(lens);
      push(BUNDLE, p, "", null, Math.min(Math.max(med - rootPly, dp + 1), cap), dp + 1, rest.length, w, dr, l, -1, med);
    }
    const count = kind.length - first;
    if (count > 0) {
      firstChild[p] = first;
      childCount[p] = count;
    }
  }

  const n = kind.length;
  // ended = games not accounted for by children (games that stop here)
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const c = childCount[i];
    for (let j = 0; j < c; j++) sum += nGames[firstChild[i] + j];
    ended[i] = nGames[i] - sum;
  }

  return {
    key: opts.key,
    path: opts.path,
    rootPly,
    color: opts.color,
    selectionGames: opts.selectionGames,
    complete,
    capped,
    depthCap: cap,
    n,
    kind: Uint8Array.from(kind),
    parent: Int32Array.from(parent),
    firstChild: Int32Array.from(firstChild),
    childCount: Uint32Array.from(childCount),
    depth: Uint16Array.from(depth),
    branchDepth: Uint16Array.from(branchDepth),
    san,
    games: Uint32Array.from(nGames),
    wins: Uint32Array.from(wins),
    draws: Uint32Array.from(draws),
    losses: Uint32Array.from(losses),
    ended: Uint32Array.from(ended),
    leafRef: Int32Array.from(leafRef),
    leafLen: Uint16Array.from(leafLen),
    rootStats: GameIndex.stats(root),
  };
}

/** A one-node tree for an empty selection or an out-of-book position. */
export function emptyCanopy(o: { key: string; path: string[]; color: Color; selectionGames: number }): CanopyTree {
  return {
    key: o.key,
    path: o.path,
    rootPly: o.path.length,
    color: o.color,
    selectionGames: o.selectionGames,
    complete: true,
    capped: false,
    depthCap: 16,
    n: 1,
    kind: Uint8Array.of(ROOT),
    parent: Int32Array.of(-1),
    firstChild: Int32Array.of(-1),
    childCount: Uint32Array.of(0),
    depth: Uint16Array.of(0),
    branchDepth: Uint16Array.of(0),
    san: [""],
    games: Uint32Array.of(0),
    wins: Uint32Array.of(0),
    draws: Uint32Array.of(0),
    losses: Uint32Array.of(0),
    ended: Uint32Array.of(0),
    leafRef: Int32Array.of(-1),
    leafLen: Uint16Array.of(0),
    rootStats: GameIndex.stats({ idx: new Uint32Array(0), wins: 0, losses: 0, draws: 0, children: null }),
  };
}

/** Transferable buffers of a tree (for Comlink.transfer). */
export function canopyBuffers(t: CanopyTree): ArrayBuffer[] {
  return [
    t.kind, t.parent, t.firstChild, t.childCount, t.depth, t.branchDepth, t.games, t.wins, t.draws, t.losses, t.ended, t.leafRef, t.leafLen,
  ].map((a) => a.buffer as ArrayBuffer);
}
