/**
 * Lazy opening tree over one color's games, used by the explorer service instead of the
 * eager `Trie` (which stays as the Python-parity port in trie.ts).
 *
 * A node holds the indices of the games that reach it (newest first) and their W/L/D
 * counts; its children are built on first visit by grouping those indices by the next
 * move. Building the root is O(n) and memory covers only the visited nodes: a few MB
 * instead of ~35 MB per color for an eager 6k-game trie. `gamesAt` is a subarray.
 *
 * In legal mode (the default; the selection starts at move 1) children are keyed by
 * chess.js SAN for the node's position: stored moves that differ only in "+"/"#", "!?"
 * or zero-castling are merged, other notations are resolved with chess.js's permissive
 * parser, and moves that are illegal in the position (variant games) are dropped. Stats are
 * otherwise identical to the eager trie. In raw mode (a `moves_start` slice, used only for
 * Python parity) children are keyed by the stored SAN exactly like `Trie`.
 */
import type { Chess } from "chess.js";
import { classifyResult, compareCodePoints, emptyStats } from "./trie";
import type { Game, NextMove, Stats } from "./types";

export interface IndexNode {
  /** Indices into `GameIndex.games`, newest first. */
  idx: Uint32Array;
  wins: number;
  losses: number;
  draws: number;
  children: Map<string, IndexNode> | null;
}

/** Normalised SAN for matching: no trailing "+", "#", "!" or "?"; "0-0" castling as "O-O". */
export function sanKey(san: string): string {
  let e = san.length;
  while (e > 0) {
    const ch = san.charCodeAt(e - 1);
    if (ch === 43 || ch === 35 || ch === 33 || ch === 63) e--;
    else break;
  }
  const s = e === san.length ? san : san.slice(0, e);
  if (s === "0-0") return "O-O";
  if (s === "0-0-0") return "O-O-O";
  return s;
}

/** Returns a chess.js board positioned after the first `depth` moves of the path being walked. */
export type BoardAt = (depth: number) => Chess;

const WIN = 0;
const LOSS = 1;
const DRAW = 2;
/** Up to this many distinct stored moves, resolve each with chess.js instead of listing all legal moves. */
const FEW_MOVES = 3;

export class GameIndex {
  readonly root: IndexNode;
  private readonly kinds: Uint8Array;

  /**
   * @param games one color's games, newest first; games with an unknown result are ignored
   * @param legal key children by legal chess.js SAN (true) or by the stored SAN (false)
   */
  constructor(
    readonly games: readonly Game[],
    readonly legal: boolean,
  ) {
    this.kinds = new Uint8Array(games.length);
    const all: number[] = [];
    for (let i = 0; i < games.length; i++) {
      const k = classifyResult(games[i].result ?? "*");
      if (k === null) continue;
      this.kinds[i] = k === "win" ? WIN : k === "loss" ? LOSS : DRAW;
      all.push(i);
    }
    this.root = this.makeNode(all);
  }

  private makeNode(list: ArrayLike<number>): IndexNode {
    const idx = Uint32Array.from(list);
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (let k = 0; k < idx.length; k++) {
      const kind = this.kinds[idx[k]];
      if (kind === WIN) wins++;
      else if (kind === LOSS) losses++;
      else draws++;
    }
    return { idx, wins, losses, draws, children: null };
  }

  static stats(node: IndexNode): Stats {
    const total = node.wins + node.losses + node.draws;
    if (total === 0) return emptyStats();
    return {
      wins: node.wins,
      losses: node.losses,
      draws: node.draws,
      total,
      winRate: node.wins / total,
      drawRate: node.draws / total,
      lossRate: node.losses / total,
    };
  }

  /**
   * Children of `node` (which sits at ply `depth`), built on first use. `seeds` maps a
   * `sanKey` to its chess.js SAN when the caller already knows it (the move it is walking),
   * so a node whose games all continue with that move needs no board work at all.
   */
  children(node: IndexNode, depth: number, boardAt: BoardAt, seeds?: ReadonlyMap<string, string>): Map<string, IndexNode> {
    if (node.children) return node.children;
    const groups = new Map<string, number[]>();
    const add = (key: string, i: number) => {
      const g = groups.get(key);
      if (g) g.push(i);
      else groups.set(key, [i]);
    };
    if (this.legal) {
      // Distinct stored moves first; deep in the tree there are only one or two, and
      // resolving those one by one is far cheaper than generating every legal move's SAN.
      const distinct = new Set<string>();
      for (let k = 0; k < node.idx.length; k++) {
        const m = this.games[node.idx[k]].moves[depth];
        if (m !== undefined) distinct.add(m);
      }
      const resolved = new Map<string, string | null>();
      const rest: string[] = [];
      for (const m of distinct) {
        const seeded = seeds?.get(sanKey(m));
        if (seeded !== undefined) resolved.set(m, seeded);
        else rest.push(m);
      }
      if (rest.length > 0) {
        const board = boardAt(depth);
        let legal: Map<string, string> | null = null;
        if (rest.length > FEW_MOVES) {
          legal = new Map();
          for (const san of board.moves()) legal.set(sanKey(san), san);
        }
        for (const m of rest) resolved.set(m, legal?.get(sanKey(m)) ?? permissive(board, m));
      }
      for (let k = 0; k < node.idx.length; k++) {
        const i = node.idx[k];
        const m = this.games[i].moves[depth];
        if (m === undefined) continue;
        const canon = resolved.get(m);
        if (canon) add(canon, i);
      }
    } else {
      for (let k = 0; k < node.idx.length; k++) {
        const i = node.idx[k];
        const m = this.games[i].moves[depth];
        if (m !== undefined) add(m, i);
      }
    }
    const children = new Map<string, IndexNode>();
    for (const [move, list] of groups) children.set(move, this.makeNode(list));
    node.children = children;
    return children;
  }

  /** Node reached by `path` (chess.js SAN in legal mode, stored SAN in raw mode), or null. */
  nodeAt(path: readonly string[], boardAt: BoardAt): IndexNode | null {
    let node = this.root;
    for (let d = 0; d < path.length; d++) {
      const child = this.children(node, d, boardAt).get(path[d]);
      if (!child) return null;
      node = child;
    }
    return node;
  }

  /** Child moves sorted like Python: total desc, then move desc (code point order). */
  next(node: IndexNode, depth: number, boardAt: BoardAt): NextMove[] {
    const next: NextMove[] = [];
    for (const [move, child] of this.children(node, depth, boardAt)) next.push({ move, stats: GameIndex.stats(child) });
    next.sort((a, b) => b.stats.total - a.stats.total || compareCodePoints(b.move, a.move));
    return next;
  }
}

/** chess.js SAN for a non-canonical but legal notation (e.g. "Nge7" with one knight, "e8Q"), else null. */
function permissive(board: Chess, san: string): string | null {
  try {
    const m = board.move(san);
    board.undo();
    return m.san;
  } catch {
    return null;
  }
}
