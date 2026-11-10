import { ROOT, type CanopyTree } from "./types";

/** Node id reached from the root by the relative SANs, or -1 if it is not in the tree. */
export function findNode(t: CanopyTree, rel: readonly string[]): number {
  let cur = 0;
  for (const san of rel) {
    const c = t.childCount[cur];
    const f = t.firstChild[cur];
    let hit = -1;
    for (let j = 0; j < c; j++) {
      if (t.san[f + j] === san && san !== "") {
        hit = f + j;
        break;
      }
    }
    if (hit < 0) return -1;
    cur = hit;
  }
  return cur;
}

/** Ids from the root down to `i` (inclusive). */
export function pathIds(t: CanopyTree, i: number): number[] {
  const out: number[] = [];
  for (let c = i; c >= 0; c = t.parent[c]) out.push(c);
  return out.reverse();
}

/** Re-root locally: the subtree under node `i` as its own tree (instant paint before the worker answers). */
export function subtree(t: CanopyTree, i: number): CanopyTree {
  if (i === 0) return t;
  // BFS keeps the "children contiguous, parents first" invariant.
  const order: number[] = [i];
  for (let h = 0; h < order.length; h++) {
    const id = order[h];
    const c = t.childCount[id];
    const f = t.firstChild[id];
    for (let j = 0; j < c; j++) order.push(f + j);
  }
  const n = order.length;
  const newId = new Map<number, number>();
  order.forEach((old, k) => newId.set(old, k));

  const kind = new Uint8Array(n);
  const parent = new Int32Array(n);
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
  const leafRef = new Int32Array(n);
  const leafLen = new Uint16Array(n);

  const base = t.depth[i];
  for (let k = 0; k < n; k++) {
    const o = order[k];
    kind[k] = k === 0 ? ROOT : t.kind[o];
    parent[k] = k === 0 ? -1 : (newId.get(t.parent[o]) as number);
    const c = t.childCount[o];
    childCount[k] = c;
    if (c > 0) firstChild[k] = newId.get(t.firstChild[o]) as number;
    depth[k] = Math.max(0, t.depth[o] - base);
    branchDepth[k] = Math.max(0, t.branchDepth[o] - base);
    san[k] = k === 0 ? "" : t.san[o];
    games[k] = t.games[o];
    wins[k] = t.wins[o];
    draws[k] = t.draws[o];
    losses[k] = t.losses[o];
    ended[k] = t.ended[o];
    leafRef[k] = t.leafRef[o];
    leafLen[k] = t.leafLen[o];
  }

  const rel = relPathTo(t, i);
  const path = [...t.path, ...rel];
  const cut = t.key.lastIndexOf("|");
  const key = (cut >= 0 ? t.key.slice(0, cut + 1) : "") + path.join(" ");
  const g = t.games[i];
  return {
    key,
    path,
    rootPly: t.rootPly + base,
    color: t.color,
    selectionGames: t.selectionGames,
    complete: t.complete,
    capped: t.capped,
    depthCap: Math.max(1, t.depthCap - base),
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
      wins: t.wins[i],
      losses: t.losses[i],
      draws: t.draws[i],
      total: g,
      winRate: g ? t.wins[i] / g : 0,
      drawRate: g ? t.draws[i] / g : 0,
      lossRate: g ? t.losses[i] / g : 0,
    },
  };
}

function relPathTo(t: CanopyTree, i: number): string[] {
  const out: string[] = [];
  for (let c = i; c > 0; c = t.parent[c]) if (t.san[c] !== "") out.push(t.san[c]);
  return out.reverse();
}
