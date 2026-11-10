// web/lib/canopy/types.ts
import type { Color, Stats } from "@/lib/engine/types";

/** Node kinds in a CanopyTree. */
export const ROOT = 0;
/** >= 2 games, children fully listed (exactly the move-table rows for that position). */
export const NODE = 1;
/** >= 2 games, not expanded yet (budget): children are provisional LEAFs, one per game, san "". */
export const FRONTIER = 2;
/** Exactly one game: the tail from here to the game's end is drawn as one stem. */
export const LEAF = 3;
/** Single-game children aggregated because the leaf cap was hit (`capped`). */
export const BUNDLE = 4;
export type CanopyKind = 0 | 1 | 2 | 3 | 4;

export interface CanopyRequest {
  /** Root line (chess.js SAN); the canopy grows from the position after it. */
  path: string[];
  /** Plies below the root to draw; omitted = auto (p95 of leaf end depth, clamped 16..120). */
  maxDepth?: number;
  /** Worker time for this call before it snapshots; default 120. Infinity = until complete. */
  budgetMs?: number;
  /** Monotonic request number; a newer call stops an older one at its next yield. */
  seq?: number;
}

/**
 * Flat, transferable tree. Index 0 is the root. Nodes are in BFS order, so parent[i] < i and
 * the children of i are contiguous: firstChild[i] .. firstChild[i] + childCount[i] - 1, sorted
 * like Python / the move table: games desc, then move desc by code point. LEAF and FRONTIER
 * children appear in that same order.
 */
export interface CanopyTree {
  /** `${selectionKey}|${color}|${path.join(" ")}`; also the key for canopyGame(). */
  key: string;
  path: string[];
  /** = path.length; absolute ply of the root (for move numbers). */
  rootPly: number;
  color: Color;
  /** Games in the selection (all positions), for "x% of your games". */
  selectionGames: number;
  /** false while FRONTIER nodes remain; ask again (budget) to refine. */
  complete: boolean;
  /** true when single-game children were aggregated into BUNDLEs. */
  capped: boolean;
  /** Rows drawn: plies below the root (auto or the requested maxDepth). */
  depthCap: number;
  n: number;
  kind: Uint8Array;
  parent: Int32Array; // -1 for the root
  firstChild: Int32Array; // -1 if none
  childCount: Uint32Array;
  /** Plies below the root. LEAF/BUNDLE: depth of the tip (game end), clamped to depthCap. */
  depth: Uint16Array;
  /** LEAF: plies below the root of its first move (= depth of parent + 1). Others: = depth. */
  branchDepth: Uint16Array;
  /** Move into the node (chess.js SAN); "" for the root and for provisional leaves. */
  san: string[];
  games: Uint32Array;
  wins: Uint32Array; // viewed side's perspective (the player's)
  draws: Uint32Array;
  losses: Uint32Array;
  /** Games that end exactly at this node (games - sum of children games). */
  ended: Uint32Array;
  /** LEAF: index of the game in the side's game list (for canopyGame); otherwise -1. */
  leafRef: Int32Array;
  /** LEAF: full game length in plies (absolute, not clamped); BUNDLE: median; else 0. */
  leafLen: Uint16Array;
  /** Root stats (same numbers as QueryResult.stats for `path`). */
  rootStats: Stats;
}
