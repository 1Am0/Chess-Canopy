import { BUNDLE, FRONTIER, LEAF, NODE, ROOT, type CanopyTree } from "./types";

/**
 * Nested test spec. `w`/`d`/`l` are the games below (and at) this node from the viewed side's
 * perspective. For nodes with `kids` they default to the sum of the kids (give larger values to
 * make some games end there);
 * a childless node with one game is a LEAF; a childless node with several games is a NODE whose
 * games all end there, unless `kind` says "frontier" or "bundle".
 */
export interface TreeSpec {
  san?: string;
  w?: number;
  d?: number;
  l?: number;
  kids?: TreeSpec[];
  /** LEAF/BUNDLE: full game length in plies (absolute). */
  leafLen?: number;
  /** LEAF: plies played after its first move (when leafLen is not given). Default 4. */
  tail?: number;
  kind?: "frontier" | "bundle" | "node";
  leafRef?: number;
}

export interface TreeSpecOptions {
  path?: string[];
  color?: "white" | "black";
  depthCap?: number;
  key?: string;
  complete?: boolean;
  capped?: boolean;
  selectionGames?: number;
}

interface Built {
  spec: TreeSpec;
  w: number;
  d: number;
  l: number;
  kids: Built[];
}

function sums(spec: TreeSpec): Built {
  const kids = (spec.kids ?? []).map(sums);
  const w = spec.w ?? kids.reduce((a, k) => a + k.w, 0);
  const d = spec.d ?? kids.reduce((a, k) => a + k.d, 0);
  const l = spec.l ?? kids.reduce((a, k) => a + k.l, 0);
  // Sort like the move table: games desc, then move desc by code point.
  kids.sort((a, b) => {
    const ga = a.w + a.d + a.l;
    const gb = b.w + b.d + b.l;
    if (ga !== gb) return gb - ga;
    const sa = a.spec.san ?? "";
    const sb = b.spec.san ?? "";
    return sa < sb ? 1 : sa > sb ? -1 : 0;
  });
  return { spec, w, d, l, kids };
}

export function treeFromSpec(spec: TreeSpec, o: TreeSpecOptions = {}): CanopyTree {
  const path = o.path ?? [];
  const rootPly = path.length;
  const root = sums(spec);

  // BFS flatten.
  const order: Built[] = [root];
  const parentOf: number[] = [-1];
  const depthOf: number[] = [0];
  for (let h = 0; h < order.length; h++) {
    for (const k of order[h].kids) {
      order.push(k);
      parentOf.push(h);
      depthOf.push(depthOf[h] + 1);
    }
  }
  const n = order.length;

  const kind = new Uint8Array(n);
  const firstChild = new Int32Array(n).fill(-1);
  const childCount = new Uint32Array(n);
  const depth = new Uint16Array(n);
  const branchDepth = new Uint16Array(n);
  const san: string[] = new Array(n);
  const games = new Uint32Array(n);
  const wins = new Uint32Array(n);
  const draws = new Uint32Array(n);
  const losses = new Uint32Array(n);
  const ended = new Uint32Array(n);
  const leafRef = new Int32Array(n).fill(-1);
  const leafLen = new Uint16Array(n);
  const parent = Int32Array.from(parentOf);

  let next = 1;
  let leafSeq = 0;
  let deepest = 1;
  const tipOf: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const b = order[i];
    const g = b.w + b.d + b.l;
    games[i] = g;
    wins[i] = b.w;
    draws[i] = b.d;
    losses[i] = b.l;
    san[i] = i === 0 ? "" : (b.spec.san ?? "");
    childCount[i] = b.kids.length;
    if (b.kids.length) {
      firstChild[i] = next;
      next += b.kids.length;
    }
    const kidGames = b.kids.reduce((a, k) => a + k.w + k.d + k.l, 0);
    ended[i] = b.kids.length ? Math.max(0, g - kidGames) : 0;
    const d0 = depthOf[i];
    depth[i] = d0;
    branchDepth[i] = d0;
    if (i === 0) {
      kind[i] = ROOT;
    } else if (b.kids.length === 0 && (b.spec.kind === "bundle" || (g === 1 && b.spec.kind === undefined))) {
      const isBundle = b.spec.kind === "bundle";
      kind[i] = isBundle ? BUNDLE : LEAF;
      const len = b.spec.leafLen ?? rootPly + d0 + (b.spec.tail ?? 4);
      leafLen[i] = len;
      tipOf[i] = Math.max(d0, len - rootPly);
      leafRef[i] = isBundle ? -1 : (b.spec.leafRef ?? leafSeq++);
      branchDepth[i] = d0;
      ended[i] = 0;
    } else if (b.kids.length === 0 && b.spec.kind === "frontier") {
      kind[i] = FRONTIER;
    } else {
      kind[i] = NODE;
      if (b.kids.length === 0) ended[i] = g;
    }
    deepest = Math.max(deepest, d0, tipOf[i]);
  }
  const depthCap = o.depthCap ?? Math.max(1, deepest);
  for (let i = 1; i < n; i++) {
    if (kind[i] === LEAF || kind[i] === BUNDLE) depth[i] = Math.min(tipOf[i], depthCap);
  }

  const g0 = games[0];
  return {
    key: o.key ?? `test|${o.color ?? "white"}|${path.join(" ")}`,
    path,
    rootPly,
    color: o.color ?? "white",
    selectionGames: o.selectionGames ?? g0,
    complete: o.complete ?? true,
    capped: o.capped ?? false,
    depthCap,
    n,
    kind,
    parent,
    firstChild,
    childCount,
    depth,
    branchDepth,
    san,
    games,
    wins,
    draws,
    losses,
    ended,
    leafRef,
    leafLen,
    rootStats: {
      wins: wins[0],
      losses: losses[0],
      draws: draws[0],
      total: g0,
      winRate: g0 ? wins[0] / g0 : 0,
      drawRate: g0 ? draws[0] / g0 : 0,
      lossRate: g0 ? losses[0] / g0 : 0,
    },
  };
}

/** Deterministic pseudo-random generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A big, trunk-heavy synthetic spec with about `games` single-game tails. Games >= 2 branch further. */
export function syntheticSpec(games: number, seed = 1, rootPly = 0): TreeSpec {
  const rand = rng(seed);
  let uid = 0;
  const san = () => `m${(uid++).toString(36)}`;
  const grow = (g: number, depth: number, name?: string): TreeSpec => {
    if (g <= 1) {
      const r = rand();
      return {
        san: name ?? san(),
        w: r < 0.5 ? 1 : 0,
        d: r >= 0.5 && r < 0.58 ? 1 : 0,
        l: r >= 0.58 ? 1 : 0,
        leafLen: rootPly + depth - 1 + 4 + Math.floor(rand() * 70),
      };
    }
    const kids: TreeSpec[] = [];
    let left = g;
    const lead = Math.max(1, Math.floor(g * (0.55 + rand() * 0.4)));
    kids.push(grow(lead, depth + 1));
    left -= lead;
    while (left > 0) {
      const take = Math.max(1, Math.floor(left * (rand() < 0.5 ? 0.5 : 0.2)));
      kids.push(grow(take, depth + 1));
      left -= take;
    }
    return { san: name ?? san(), kids };
  };
  return { kids: grow(games, 0, "x").kids };
}

export interface RecordedCall {
  op: string;
  args: unknown[];
  /** Snapshot of globalAlpha when the call was made. */
  alpha: number;
}

/** A recording canvas 2D context for tests: every method call is logged, properties are stored. */
export function fakeContext(): { ctx: CanvasRenderingContext2D; calls: RecordedCall[]; count: (op: string) => number } {
  const calls: RecordedCall[] = [];
  const props: Record<string, unknown> = { globalAlpha: 1 };
  const ctx = new Proxy(
    {},
    {
      get(_t, key: string) {
        if (key in props) return props[key];
        return (...args: unknown[]) => {
          calls.push({ op: key, args, alpha: props.globalAlpha as number });
          if (key === "createLinearGradient") {
            return { addColorStop: (...a: unknown[]) => calls.push({ op: "addColorStop", args: a, alpha: 1 }) };
          }
        };
      },
      set(_t, key: string, value) {
        props[key] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, count: (op) => calls.filter((c) => c.op === op).length };
}
