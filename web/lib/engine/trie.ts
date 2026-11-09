import type { NextMove, Stats } from "./types";

const WIN = new Set(["1-0", "w", "white", "win", "wins"]);
const LOSS = new Set(["0-1", "b", "black", "loss", "lose", "loses"]);
const DRAW = new Set(["1/2-1/2", "draw", "d", "=", "½"]);

export type ResultKind = "win" | "loss" | "draw";

/** Classify a result token exactly like Python `_increment_result`; null for unknown tokens. */
export function classifyResult(result: string): ResultKind | null {
  const token = result.trim().toLowerCase();
  if (WIN.has(token)) return "win";
  if (LOSS.has(token)) return "loss";
  if (DRAW.has(token)) return "draw";
  return null;
}

export function emptyStats(): Stats {
  return { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0, drawRate: 0, lossRate: 0 };
}

export class TrieNode {
  val: string | null;
  children: Map<string, TrieNode> = new Map();
  totalWins = 0;
  totalLosses = 0;
  totalDraws = 0;

  constructor(val: string | null = null) {
    this.val = val;
  }

  /** Throws on unknown tokens (Python raises ValueError). */
  incrementResult(result: string): void {
    const kind = classifyResult(result);
    if (kind === "win") this.totalWins++;
    else if (kind === "loss") this.totalLosses++;
    else if (kind === "draw") this.totalDraws++;
    else throw new Error(`Unknown result token: ${result}`);
  }

  stats(): Stats {
    const total = this.totalWins + this.totalLosses + this.totalDraws;
    if (total === 0) return emptyStats();
    return {
      wins: this.totalWins,
      losses: this.totalLosses,
      draws: this.totalDraws,
      total,
      winRate: this.totalWins / total,
      drawRate: this.totalDraws / total,
      lossRate: this.totalLosses / total,
    };
  }

  nextMoves(): Map<string, Stats> {
    const out = new Map<string, Stats>();
    for (const [move, child] of this.children) out.set(move, child.stats());
    return out;
  }

  isLeaf(): boolean {
    return this.children.size === 0;
  }
}

export class Trie {
  root = new TrieNode();

  /**
   * Add a game. Throws on an unknown result token before mutating anything
   * (Python raises at the root increment, which is also before any mutation).
   */
  addGame(moves: Iterable<string>, result: string): void {
    const kind = classifyResult(result);
    if (kind === null) throw new Error(`Unknown result token: ${result}`);
    let node = this.root;
    bump(node, kind);
    for (const move of moves) {
      let child = node.children.get(move);
      if (!child) {
        child = new TrieNode(move);
        node.children.set(move, child);
      }
      node = child;
      bump(node, kind);
    }
  }

  find(moves: Iterable<string>): TrieNode | null {
    let node: TrieNode | null = this.root;
    for (const move of moves) {
      node = node.children.get(move) ?? null;
      if (node === null) return null;
    }
    return node;
  }

  stats(moves: Iterable<string>): Stats {
    const node = this.find(moves);
    return node ? node.stats() : emptyStats();
  }

  nextMoves(moves: Iterable<string>): Map<string, Stats> {
    const node = this.find(moves);
    return node ? node.nextMoves() : new Map();
  }
}

function bump(node: TrieNode, kind: ResultKind): void {
  if (kind === "win") node.totalWins++;
  else if (kind === "loss") node.totalLosses++;
  else node.totalDraws++;
}

/** Compare strings by Unicode code point (Python `str` ordering). Returns <0, 0, >0. */
export function compareCodePoints(a: string, b: string): number {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const x = ia.next();
    const y = ib.next();
    if (x.done && y.done) return 0;
    if (x.done) return -1;
    if (y.done) return 1;
    const cx = x.value.codePointAt(0)!;
    const cy = y.value.codePointAt(0)!;
    if (cx !== cy) return cx < cy ? -1 : 1;
  }
}

/**
 * Stats at `path` plus child moves sorted like Python
 * `sorted(items, key=(total, move), reverse=True)`: total desc, then move desc (code point order).
 */
export function nextMovesForPath(trie: Trie, path: string[]): { stats: Stats; next: NextMove[] } {
  const node = trie.find(path);
  if (!node) return { stats: emptyStats(), next: [] };
  const next: NextMove[] = [];
  for (const [move, child] of node.children) next.push({ move, stats: child.stats() });
  next.sort((a, b) => b.stats.total - a.stats.total || compareCodePoints(b.move, a.move));
  return { stats: node.stats(), next };
}
