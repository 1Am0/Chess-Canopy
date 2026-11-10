import type { Color } from "@/lib/engine/types";
import { BUNDLE, FRONTIER, LEAF, NODE, ROOT, type CanopyTree } from "@/lib/canopy/types";
import { moveLabel } from "@/lib/canopy/labels";
import { pct } from "@/lib/format";
import type { Wdb } from "@/components/explorer/wdb";
import { wdbPercents } from "@/components/explorer/wdb";

export type LeafResult = "win" | "draw" | "loss";

export interface NodeInfo {
  id: number;
  kind: number;
  san: string;
  games: number;
  /** games / games of the parent, 0..1 */
  share: number;
  /** Raw score from the player's side, 0..1 */
  score: number;
  /** Chess-convention split (White / Draw / Black) */
  wdb: Wdb;
  /** Full-move number of the node's move ("move 14") */
  moveNo: number;
  /** "6.Re1" / "6…b5", or "" for the root and provisional leaves */
  label: string;
  isLeaf: boolean;
  isBundle: boolean;
  leafResult: LeafResult | null;
  /** Plies played after the leaf's first move until the game ended (leaf only) */
  moreMoves: number;
}

export function nodeInfo(t: CanopyTree, i: number, side: Color): NodeInfo {
  const games = t.games[i];
  const p = t.parent[i];
  const parentGames = p >= 0 ? t.games[p] : games;
  const total = games || 1;
  const kind = t.kind[i];
  const isLeaf = kind === LEAF;
  const w = t.wins[i];
  const d = t.draws[i];
  const l = t.losses[i];
  const absPly = t.rootPly + t.depth[i] - 1; // ply index (0-based) of the move into this node
  const firstPly = t.rootPly + t.branchDepth[i] - 1;
  return {
    id: i,
    kind,
    san: t.san[i],
    games,
    share: parentGames ? games / parentGames : 0,
    score: games ? (w + d / 2) / total : 0,
    wdb: side === "white" ? { white: w, draw: d, black: l, total: games } : { white: l, draw: d, black: w, total: games },
    moveNo: Math.floor(Math.max(absPly, 0) / 2) + 1,
    label: kind === ROOT || !t.san[i] ? "" : moveLabel(isLeaf ? firstPly : absPly, t.san[i]),
    isLeaf,
    isBundle: kind === BUNDLE,
    leafResult: isLeaf ? (w ? "win" : l ? "loss" : "draw") : null,
    moreMoves: isLeaf ? Math.max(0, t.leafLen[i] - (t.rootPly + t.branchDepth[i])) : 0,
  };
}

/** The accessible name of a tree item (section 4.7). */
export function nodeName(t: CanopyTree, i: number, side: Color): string {
  const n = nodeInfo(t, i, side);
  if (n.isLeaf) {
    const mv = n.label ? n.label.replace("…", "… ").replace(".", ". ") : "a game";
    const more = n.moreMoves > 0 ? ` and ${n.moreMoves} more ${n.moreMoves === 1 ? "move" : "moves"}` : "";
    return `Single game: ${mv}${more}, ${n.leafResult}`;
  }
  if (n.isBundle) return `${n.games.toLocaleString()} more single games`;
  const p = wdbPercents(n.wdb);
  const where = n.label ? n.label.replace("…", "… ").replace(".", ". ") : "Move";
  return `${where}: ${n.games.toLocaleString()} ${n.games === 1 ? "game" : "games"}, ${pct(n.share)} of parent, score ${pct(n.score)}, White ${Math.round(p.white)}%, draw ${Math.round(p.draw)}%, Black ${Math.round(p.black)}%`;
}

/** Items the tree nav and the keyboard can land on. */
export function isNavigable(t: CanopyTree, i: number): boolean {
  const k = t.kind[i];
  return k === NODE || k === FRONTIER || k === LEAF;
}

/** "Tree of 2,903 positions and 3,095 games, up to 96 moves deep." */
export function treeSummary(t: CanopyTree): string {
  let positions = 0;
  for (let i = 1; i < t.n; i++) if (t.kind[i] === NODE || t.kind[i] === FRONTIER) positions++;
  const moves = Math.ceil(t.depthCap / 2);
  return `Tree of ${positions.toLocaleString()} ${positions === 1 ? "position" : "positions"} and ${t.rootStats.total.toLocaleString()} ${t.rootStats.total === 1 ? "game" : "games"}, up to ${moves} moves deep.`;
}

/** Ids (root first) of the longest prefix of `rel` that exists in the tree; just the root when none. */
export function lineIdsFor(t: CanopyTree, rel: readonly string[]): number[] {
  const ids = [0];
  let cur = 0;
  for (const san of rel) {
    const f = t.firstChild[cur];
    let hit = -1;
    for (let j = 0; j < t.childCount[cur] && f >= 0; j++) {
      if (t.san[f + j] === san && san !== "") {
        hit = f + j;
        break;
      }
    }
    if (hit < 0) break;
    ids.push(hit);
    cur = hit;
    if (t.kind[hit] === LEAF || t.kind[hit] === BUNDLE) break;
  }
  return ids.length > 1 ? ids : [];
}
