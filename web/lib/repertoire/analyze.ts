/**
 * Repertoire analysis (pure, no IndexedDB): which positions you reach with you to move, what you play there, how
 * consistently, whether you switched moves at some point, and which games left your locked repertoire.
 *
 * Every game is replayed from the start up to and including your move `maxMove`. chess.js moves are slow (each one
 * generates the legal moves and hashes with BigInt), so the replay goes through a move trie keyed by the stored SAN:
 * a ply already seen in another game (same stored moves before it) reuses that game's canonical SAN and FEN, and
 * chess.js only runs for plies no earlier game shared. One Chess instance is used for the whole run; it is loaded with
 * the trie node's FEN at the first new ply of a game (and again only if the game rejoins and then leaves known plies).
 */
import { Chess } from "chess.js";
import { sanKey } from "../engine/position-index";
import { classifyResult, type ResultKind } from "../engine/trie";
import type { Color, Game, GameSummary } from "../engine/types";
import { START_FEN } from "../importers/standard";
import {
  MAX_DEVIATIONS,
  MIN_GAMES,
  SWITCH_MIN_GAMES,
  SWITCH_SHARE,
  type DecisionPoint,
  type Deviation,
  type MoveSwitch,
  type MoveUsage,
  type RepertoireEntry,
} from "./types";

export interface AnalyzeOptions {
  side: Color;
  /** Last full move number analysed (your moves up to and including this one). */
  maxMove: number;
  /** Saved repertoire moves (entries of the other side are ignored). */
  locked: RepertoireEntry[];
}

export interface AnalyzeResult {
  points: DecisionPoint[];
  deviations: Deviation[];
}

/** Position key: the first four FEN fields. */
export function epdOf(fen: string): string {
  return fen.split(" ", 4).join(" ");
}

/** The summary the UI lists for a game (the same fields ExplorerService.gamesAt returns). */
export function summarizeGame(g: Game): GameSummary {
  return {
    game_id: g.game_id,
    date: g.date,
    opponent: g.opponent,
    my_rating: g.my_rating,
    opponent_rating: g.opponent_rating,
    result: g.result,
    color: g.color,
    url: g.url,
    source: g.source,
    time_control: g.time_control,
    moves: g.moves,
  };
}

/** UTC YYYY-MM-DD of a ms timestamp. */
function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The parts of chess.js 1.x's internals the fast path uses (see `play`). */
interface InternalMove {
  /** 0x88 squares */
  from: number;
  to: number;
  piece: string;
  promotion?: string;
}
interface ChessInternals {
  _moveFromSan(san: string, strict: boolean): InternalMove | null;
  _moves(opts: { legal: boolean; piece?: string }): InternalMove[];
  _moveToSan(move: InternalMove, moves: InternalMove[]): string;
  _makeMove(move: InternalMove): void;
}

const hasInternals = (() => {
  const c = new Chess() as unknown as Partial<ChessInternals>;
  return (
    typeof c._moveFromSan === "function" &&
    typeof c._moves === "function" &&
    typeof c._moveToSan === "function" &&
    typeof c._makeMove === "function"
  );
})();

/** Plain SAN (decorations already stripped): piece, from file, from rank, target, promotion. */
const SAN_RE = /^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?([NBRQnbrq]))?$/;

/**
 * The legal move a plain SAN names when exactly one legal move fits it, with that piece's legal moves (for
 * disambiguating the canonical SAN); null when the SAN is not plain or does not name exactly one move (chess.js's own
 * parser then decides).
 */
function resolvePlain(c: ChessInternals, clean: string): { move: InternalMove; moves: InternalMove[] } | null {
  const m = SAN_RE.exec(clean);
  if (!m) return null;
  const piece = m[1] ? m[1].toLowerCase() : "p";
  const to = (8 - Number(m[4][1])) * 16 + (m[4].charCodeAt(0) - 97);
  const file = m[2] ? m[2].charCodeAt(0) - 97 : -1;
  const rank = m[3] ? Number(m[3]) : -1;
  const promo = m[5] ? m[5].toLowerCase() : undefined;
  const moves = c._moves({ legal: true, piece });
  let found: InternalMove | null = null;
  for (const mv of moves) {
    if (mv.to !== to || mv.piece !== piece || mv.promotion !== promo) continue;
    if (file >= 0 && (mv.from & 15) !== file) continue;
    if (rank >= 0 && 8 - (mv.from >> 4) !== rank) continue;
    if (found) return null;
    found = mv;
  }
  return found ? { move: found, moves } : null;
}

/**
 * Plays a stored move (chess.js permissive parsing) and returns its chess.js SAN and the FEN after it, or null when
 * it is illegal (a null move "--" counts as illegal).
 *
 * The public `move()` parses by generating the SAN of every candidate and then builds a full Move object (all legal
 * moves, two FENs, a make/undo): most of the cost of a replay. When chess.js's internals are there (1.x), a plain SAN
 * is matched against the moving piece's legal moves directly, anything else goes through the same parser `move()`
 * uses, and the SAN is generated once (disambiguated against the same piece's legal moves, which is all chess.js's
 * disambiguation looks at). Falls back to `move()` otherwise.
 */
export function play(chess: Chess, stored: string): { san: string; fen: string } | null {
  const clean = sanKey(stored);
  if (clean === "--") return null;
  if (hasInternals) {
    const c = chess as unknown as ChessInternals;
    let hit = resolvePlain(c, clean);
    if (!hit) {
      let mv: InternalMove | null;
      try {
        mv = c._moveFromSan(stored, false);
      } catch {
        return null;
      }
      if (!mv) return null;
      hit = { move: mv, moves: c._moves({ legal: true, piece: mv.piece }) };
    }
    const san = c._moveToSan(hit.move, hit.moves);
    c._makeMove(hit.move);
    return { san, fen: chess.fen() };
  }
  try {
    const m = chess.move(stored);
    return { san: m.san, fen: m.after };
  } catch {
    return null;
  }
}

/**
 * Move trie over the stored moves. Node 0 is the start position; every other node is the position after one stored
 * move, with the chess.js SAN of that move (null when it was illegal) and the FEN after it.
 */
class MoveTrie {
  parent: number[] = [-1];
  san: (string | null)[] = [null];
  fen: string[] = [START_FEN];
  private epds: (string | undefined)[] = [undefined];
  private kids: (Map<string, number> | undefined)[] = [undefined];

  child(node: number, stored: string): number | undefined {
    return this.kids[node]?.get(sanKey(stored));
  }

  add(node: number, stored: string, san: string | null, fen: string): number {
    const id = this.parent.length;
    this.parent.push(node);
    this.san.push(san);
    this.fen.push(fen);
    this.kids.push(undefined);
    this.epds.push(undefined);
    let map = this.kids[node];
    if (!map) this.kids[node] = map = new Map();
    map.set(sanKey(stored), id);
    return id;
  }

  epd(node: number): string {
    return (this.epds[node] ??= epdOf(this.fen[node]));
  }

  /** chess.js SAN moves from the start to `node`. */
  line(node: number): string[] {
    const out: string[] = [];
    for (let n = node; n > 0; n = this.parent[n]) out.push(this.san[n] as string);
    return out.reverse();
  }
}

interface Visit {
  /** Index of the game in the input (input is newest first). */
  gi: number;
  date: string;
  san: string;
  kind: ResultKind;
}

interface PositionAgg {
  epd: string;
  fen: string;
  visits: Visit[];
  /** Trie node of the position → games that reached it that way (each is one move order). */
  lines: Map<number, { count: number; newest: number }>;
  /** fenAfter per move. */
  after: Map<string, string>;
  lastGi: number;
}

/** Most common entry of `counts` (ties: san ascending); null when empty. */
function mostCommon(counts: Map<string, number>): { san: string; n: number } | null {
  let best: { san: string; n: number } | null = null;
  for (const [san, n] of counts) {
    if (n === 0) continue;
    if (!best || n > best.n || (n === best.n && san < best.san)) best = { san, n };
  }
  return best;
}

/**
 * The earliest date D from which on at least SWITCH_MIN_GAMES games were played, SWITCH_SHARE of them with one move M,
 * while before D (at least one game) the most common move was a different move F. When M ties with the most common
 * move before D, the change is not clear-cut and D does not qualify.
 */
export function detectSwitch(visits: readonly { date: string; san: string }[]): MoveSwitch | null {
  const distinct = new Set(visits.map((v) => v.san));
  if (distinct.size < 2) return null;
  const sorted = [...visits].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const before = new Map<string, number>();
  const since = new Map<string, number>();
  for (const v of sorted) since.set(v.san, (since.get(v.san) ?? 0) + 1);
  let nSince = sorted.length;
  let i = 0;
  while (i < sorted.length) {
    const date = sorted[i].date;
    if (i > 0 && nSince >= SWITCH_MIN_GAMES) {
      const m = mostCommon(since);
      if (m && m.n >= SWITCH_SHARE * nSince - 1e-9) {
        const top = mostCommon(before);
        const mBefore = before.get(m.san) ?? 0;
        if (top && top.n > mBefore) {
          // Report the switch from the first game that actually played the new move (the earliest qualifying date can
          // still be a last game with the old move). Starting there only drops old-move games, so the rule still holds.
          let k = i;
          while (sorted[k].san !== m.san) k++;
          const start = sorted[k].date;
          const gamesSince = sorted.filter((v) => v.date >= start).length;
          return { from: top.san, to: m.san, date: start, gamesSince };
        }
      }
    }
    if (nSince < SWITCH_MIN_GAMES) break; // later dates only have fewer games
    // move every game of this date to "before"
    while (i < sorted.length && sorted[i].date === date) {
      const s = sorted[i].san;
      before.set(s, (before.get(s) ?? 0) + 1);
      since.set(s, (since.get(s) ?? 0) - 1);
      nSince--;
      i++;
    }
  }
  return null;
}

export function analyzeRepertoire(games: Game[], opts: AnalyzeOptions): AnalyzeResult {
  const { side } = opts;
  const maxMove = Math.max(1, Math.floor(opts.maxMove));
  const mine = side === "white" ? 0 : 1;
  const lastPly = side === "white" ? 2 * (maxMove - 1) : 2 * maxMove - 1;

  const locked = new Map<string, { san: string; since: string }>();
  for (const e of opts.locked) if (e.side === side) locked.set(e.epd, { san: e.san, since: utcDay(e.lockedAt) });

  const trie = new MoveTrie();
  const chess = new Chess();
  const positions = new Map<string, PositionAgg>();
  const deviations: { gi: number; d: Deviation }[] = [];

  for (let gi = 0; gi < games.length; gi++) {
    const g = games[gi];
    const kind = classifyResult(g.result ?? "*");
    if (kind === null || !Array.isArray(g.moves)) continue;
    const moves = g.moves;
    const end = Math.min(lastPly, moves.length - 1);
    let node = 0;
    let synced = false; // is `chess` at `node`?
    let deviated = false;
    for (let ply = 0; ply <= end; ply++) {
      let next = trie.child(node, moves[ply]);
      if (next === undefined) {
        if (!synced) {
          chess.load(trie.fen[node]);
          synced = true;
        }
        const played = play(chess, moves[ply]);
        if (played === null) synced = false; // a failed move leaves the board alone, but be safe
        next = trie.add(node, moves[ply], played?.san ?? null, played?.fen ?? "");
      } else {
        synced = false; // the board stays where it was; the next new ply loads this node's FEN
      }
      const san = trie.san[next];
      if (san === null) break; // illegal stored move: skip the rest of this game

      if (ply % 2 === mine) {
        const epd = trie.epd(node);
        let p = positions.get(epd);
        if (!p) {
          p = { epd, fen: trie.fen[node], visits: [], lines: new Map(), after: new Map(), lastGi: -1 };
          positions.set(epd, p);
        }
        if (p.lastGi !== gi) {
          p.lastGi = gi;
          p.visits.push({ gi, date: g.date, san, kind });
          const l = p.lines.get(node);
          if (l) l.count++;
          else p.lines.set(node, { count: 1, newest: gi });
          if (!p.after.has(san)) p.after.set(san, trie.fen[next]);
        }
        if (!deviated) {
          const lock = locked.get(epd);
          if (lock && g.date >= lock.since && san !== lock.san) {
            deviated = true;
            deviations.push({ gi, d: { epd, line: trie.line(node), expected: lock.san, played: san, game: summarizeGame(g) } });
          }
        }
      }
      node = next;
    }
  }

  const points: DecisionPoint[] = [];
  for (const p of positions.values()) {
    if (p.visits.length < MIN_GAMES) continue;
    points.push(toPoint(p, trie, locked.get(p.epd)?.san ?? null));
  }
  points.sort(
    (a, b) =>
      b.priority - a.priority ||
      b.games - a.games ||
      a.moveNumber - b.moveNumber ||
      (a.epd < b.epd ? -1 : a.epd > b.epd ? 1 : 0),
  );

  deviations.sort((a, b) => (a.d.game.date < b.d.game.date ? 1 : a.d.game.date > b.d.game.date ? -1 : a.gi - b.gi));
  return { points, deviations: deviations.slice(0, MAX_DEVIATIONS).map((x) => x.d) };
}

function toPoint(p: PositionAgg, trie: MoveTrie, locked: string | null): DecisionPoint {
  // moves
  const usage = new Map<string, MoveUsage>();
  for (const v of p.visits) {
    let u = usage.get(v.san);
    if (!u) {
      u = { san: v.san, games: 0, wins: 0, draws: 0, losses: 0, firstDate: v.date, lastDate: v.date, fenAfter: p.after.get(v.san) as string };
      usage.set(v.san, u);
    }
    u.games++;
    if (v.kind === "win") u.wins++;
    else if (v.kind === "draw") u.draws++;
    else u.losses++;
    if (v.date < u.firstDate) u.firstDate = v.date;
    if (v.date > u.lastDate) u.lastDate = v.date;
  }
  const moves = [...usage.values()].sort((a, b) => b.games - a.games || (a.san < b.san ? -1 : a.san > b.san ? 1 : 0));

  // most common move order (ties: the one seen in the newest game); different stored spellings of one canonical
  // line are merged
  const byLine = new Map<string, { line: string[]; count: number; newest: number }>();
  for (const [node, l] of p.lines) {
    const line = trie.line(node);
    const key = line.join(" ");
    const e = byLine.get(key);
    if (e) {
      e.count += l.count;
      e.newest = Math.min(e.newest, l.newest);
    } else byLine.set(key, { line, count: l.count, newest: l.newest });
  }
  let best: { line: string[]; count: number; newest: number } | null = null;
  for (const e of byLine.values()) if (!best || e.count > best.count || (e.count === best.count && e.newest < best.newest)) best = e;

  const sw = detectSwitch(p.visits);
  const main = locked ?? sw?.to ?? moves[0].san;
  const current = sw ? p.visits.filter((v) => v.date >= sw.date) : p.visits;
  const used = current.reduce((n, v) => n + (v.san === main ? 1 : 0), 0);
  const consistency = current.length ? used / current.length : 0;
  const priority = Math.round(current.length * (1 - consistency) * 10_000) / 10_000;
  const moveNumber = Number(p.fen.split(" ")[5]) || 1;

  return {
    epd: p.epd,
    fen: p.fen,
    line: best ? best.line : [],
    moveNumber,
    games: p.visits.length,
    moves,
    main,
    consistency,
    switch: sw,
    priority,
    locked,
  };
}
