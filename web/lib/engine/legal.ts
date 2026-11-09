/**
 * A small, fast SAN replayer used to validate imported games (standard chess from the
 * initial position). chess.js needs ~45 s to replay the 436k plies of a 6k-game account
 * because every `move()` regenerates and stringifies all legal moves; this checks the
 * same rules in well under a second.
 *
 * It is a *validator*, not a move generator for the UI: when it rejects a move,
 * `replayCheck` confirms with chess.js, so a game is only reported illegal when chess.js
 * (which the explorer uses everywhere else) rejects it too.
 */
import { Chess } from "chess.js";

// Piece codes; white > 0, black < 0.
const P = 1;
const N = 2;
const B = 3;
const R = 4;
const Q = 5;
const K = 6;

const KNIGHT: ReadonlyArray<readonly [number, number]> = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING: ReadonlyArray<readonly [number, number]> = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ORTHO: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: ReadonlyArray<readonly [number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const PIECE_OF: Record<string, number> = { N, B, R, Q, K };

const PIECE_RE = /^([NBRQK])([a-h])?([1-8])?(x)?([a-h])([1-8])$/;
const PAWN_RE = /^P?([a-h])(?:x([a-h]))?([1-8])(?:=?([NBRQnbrq]))?$/;

const sq = (f: number, r: number) => r * 8 + f;
const onBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

export class FastBoard {
  b = new Int8Array(64);
  /** 1 = white to move, -1 = black */
  turn: 1 | -1 = 1;
  /** bits: 1 = K, 2 = Q, 4 = k, 8 = q */
  castle = 15;
  ep = -1;
  kings: [number, number] = [4, 60];

  constructor() {
    const back = [R, N, B, Q, K, B, N, R];
    for (let f = 0; f < 8; f++) {
      this.b[f] = back[f];
      this.b[8 + f] = P;
      this.b[48 + f] = -P;
      this.b[56 + f] = -back[f];
    }
  }

  private kingOf(color: 1 | -1): number {
    return this.kings[color === 1 ? 0 : 1];
  }

  /** Is square `s` attacked by any piece of `by`? */
  attacked(s: number, by: 1 | -1): boolean {
    const b = this.b;
    const f = s & 7;
    const r = s >> 3;
    const pr = r - by;
    if (pr >= 0 && pr < 8) {
      if (f > 0 && b[pr * 8 + f - 1] === by * P) return true;
      if (f < 7 && b[pr * 8 + f + 1] === by * P) return true;
    }
    for (const [df, dr] of KNIGHT) {
      const nf = f + df;
      const nr = r + dr;
      if (onBoard(nf, nr) && b[sq(nf, nr)] === by * N) return true;
    }
    for (const [df, dr] of KING) {
      const nf = f + df;
      const nr = r + dr;
      if (onBoard(nf, nr) && b[sq(nf, nr)] === by * K) return true;
    }
    for (const [df, dr] of ORTHO) {
      let nf = f + df;
      let nr = r + dr;
      while (onBoard(nf, nr)) {
        const v = b[sq(nf, nr)];
        if (v !== 0) {
          if (v === by * R || v === by * Q) return true;
          break;
        }
        nf += df;
        nr += dr;
      }
    }
    for (const [df, dr] of DIAG) {
      let nf = f + df;
      let nr = r + dr;
      while (onBoard(nf, nr)) {
        const v = b[sq(nf, nr)];
        if (v !== 0) {
          if (v === by * B || v === by * Q) return true;
          break;
        }
        nf += df;
        nr += dr;
      }
    }
    return false;
  }

  /** Would moving from -> to (optionally capturing en passant on `epCap`) leave the mover's king safe? */
  private safe(from: number, to: number, epCap: number): boolean {
    const b = this.b;
    const color = this.turn;
    const moving = b[from];
    const captured = b[to];
    const epPiece = epCap >= 0 ? b[epCap] : 0;
    b[to] = moving;
    b[from] = 0;
    if (epCap >= 0) b[epCap] = 0;
    const king = moving === color * K ? to : this.kingOf(color);
    const ok = !this.attacked(king, -color as 1 | -1);
    b[from] = moving;
    b[to] = captured;
    if (epCap >= 0) b[epCap] = epPiece;
    return ok;
  }

  /** True when the side to move has at least one legal move (castling is never the only one). */
  hasLegalMove(): boolean {
    const b = this.b;
    const c = this.turn;
    for (let s = 0; s < 64; s++) {
      const v = b[s] * c;
      if (v <= 0) continue;
      const f = s & 7;
      const r = s >> 3;
      const tryTo = (t: number, epCap = -1) => this.safe(s, t, epCap);
      if (v === P) {
        const nr = r + c;
        if (nr < 0 || nr > 7) continue;
        if (b[sq(f, nr)] === 0) {
          if (tryTo(sq(f, nr))) return true;
          const start = c === 1 ? 1 : 6;
          if (r === start && b[sq(f, nr + c)] === 0 && tryTo(sq(f, nr + c))) return true;
        }
        for (const df of [-1, 1]) {
          const nf = f + df;
          if (nf < 0 || nf > 7) continue;
          const t = sq(nf, nr);
          if (b[t] * c < 0 && tryTo(t)) return true;
          if (t === this.ep && tryTo(t, sq(nf, r))) return true;
        }
      } else if (v === N || v === K) {
        for (const [df, dr] of v === N ? KNIGHT : KING) {
          const nf = f + df;
          const nr = r + dr;
          if (!onBoard(nf, nr)) continue;
          const t = sq(nf, nr);
          if (b[t] * c <= 0 && tryTo(t)) return true;
        }
      } else {
        const dirs = v === R ? ORTHO : v === B ? DIAG : [...ORTHO, ...DIAG];
        for (const [df, dr] of dirs) {
          let nf = f + df;
          let nr = r + dr;
          while (onBoard(nf, nr)) {
            const t = sq(nf, nr);
            if (b[t] * c > 0) break;
            if (tryTo(t)) return true;
            if (b[t] !== 0) break;
            nf += df;
            nr += dr;
          }
        }
      }
    }
    return false;
  }

  private doMove(from: number, to: number, epCap: number, promo: number): void {
    const b = this.b;
    const c = this.turn;
    const moving = b[from];
    b[to] = promo ? c * promo : moving;
    b[from] = 0;
    if (epCap >= 0) b[epCap] = 0;
    if (moving === c * K) this.kings[c === 1 ? 0 : 1] = to;
    // Castling rights: any move from/to a king or rook home square clears them.
    for (const s of [from, to]) {
      if (s === 4) this.castle &= ~3;
      else if (s === 60) this.castle &= ~12;
      else if (s === 7) this.castle &= ~1;
      else if (s === 0) this.castle &= ~2;
      else if (s === 63) this.castle &= ~4;
      else if (s === 56) this.castle &= ~8;
    }
    this.ep = moving === c * P && Math.abs(to - from) === 16 ? (from + to) / 2 : -1;
    this.turn = -c as 1 | -1;
  }

  private castleMove(long: boolean): boolean {
    const c = this.turn;
    const base = c === 1 ? 0 : 56;
    const right = c === 1 ? (long ? 2 : 1) : long ? 8 : 4;
    const b = this.b;
    const king = base + 4;
    const rook = base + (long ? 0 : 7);
    if (!(this.castle & right) || b[king] !== c * K || b[rook] !== c * R) return false;
    const between = long ? [base + 1, base + 2, base + 3] : [base + 5, base + 6];
    if (between.some((s) => b[s] !== 0)) return false;
    const opp = -c as 1 | -1;
    const path = long ? [king, base + 3, base + 2] : [king, base + 5, base + 6];
    if (path.some((s) => this.attacked(s, opp))) return false;
    const kTo = base + (long ? 2 : 6);
    const rTo = base + (long ? 3 : 5);
    b[rTo] = b[rook];
    b[rook] = 0;
    this.doMove(king, kTo, -1, 0);
    return true;
  }

  /**
   * Play one SAN move. Returns "ok", "illegal" (no unique legal move matches), or "badmark"
   * (the move is legal but its "+"/"#" suffix is wrong, e.g. a King of the Hill or
   * Three-check win written as mate). Missing check marks are accepted.
   */
  playSan(raw: string): "ok" | "illegal" | "badmark" {
    let s = raw;
    let mark = "";
    while (s.length > 0) {
      const ch = s[s.length - 1];
      if (ch === "!" || ch === "?") s = s.slice(0, -1);
      else if (ch === "+" || ch === "#") {
        if (!mark || ch === "#") mark = ch;
        s = s.slice(0, -1);
      } else break;
    }
    let ok: boolean;
    if (s === "O-O" || s === "0-0") ok = this.castleMove(false);
    else if (s === "O-O-O" || s === "0-0-0") ok = this.castleMove(true);
    else ok = this.pieceMove(s);
    if (!ok) return "illegal";
    if (mark) {
      const check = this.attacked(this.kingOf(this.turn), -this.turn as 1 | -1);
      if (!check) return "badmark";
      if (mark === "#" && this.hasLegalMove()) return "badmark";
    }
    return "ok";
  }

  private pieceMove(s: string): boolean {
    const b = this.b;
    const c = this.turn;
    let m = PIECE_RE.exec(s);
    if (m) {
      const type = PIECE_OF[m[1]];
      const ff = m[2] ? m[2].charCodeAt(0) - 97 : -1;
      const fr = m[3] ? Number(m[3]) - 1 : -1;
      const tf = m[5].charCodeAt(0) - 97;
      const tr = Number(m[6]) - 1;
      const to = sq(tf, tr);
      if (b[to] * c > 0) return false;
      if (m[4] && b[to] === 0) return false;
      const cands: number[] = [];
      if (type === N || type === K) {
        for (const [df, dr] of type === N ? KNIGHT : KING) {
          const nf = tf - df;
          const nr = tr - dr;
          if (onBoard(nf, nr) && b[sq(nf, nr)] === c * type) cands.push(sq(nf, nr));
        }
      } else {
        const dirs = type === R ? ORTHO : type === B ? DIAG : [...ORTHO, ...DIAG];
        for (const [df, dr] of dirs) {
          let nf = tf + df;
          let nr = tr + dr;
          while (onBoard(nf, nr)) {
            const v = b[sq(nf, nr)];
            if (v !== 0) {
              if (v === c * type) cands.push(sq(nf, nr));
              break;
            }
            nf += df;
            nr += dr;
          }
        }
      }
      let from = -1;
      for (const cand of cands) {
        if (ff >= 0 && (cand & 7) !== ff) continue;
        if (fr >= 0 && cand >> 3 !== fr) continue;
        if (!this.safe(cand, to, -1)) continue;
        if (from >= 0) return false; // ambiguous
        from = cand;
      }
      if (from < 0) return false;
      this.doMove(from, to, -1, 0);
      return true;
    }
    m = PAWN_RE.exec(s);
    if (!m) return false;
    const ff = m[1].charCodeAt(0) - 97;
    const capture = m[2] !== undefined;
    const tf = capture ? m[2].charCodeAt(0) - 97 : ff;
    const tr = Number(m[3]) - 1;
    const last = c === 1 ? 7 : 0;
    const promo = m[4] ? PIECE_OF[m[4].toUpperCase()] : tr === last ? Q : 0;
    if (promo && tr !== last) return false;
    const to = sq(tf, tr);
    const fromRank = tr - c;
    if (fromRank < 0 || fromRank > 7) return false;
    if (capture) {
      if (Math.abs(tf - ff) !== 1) return false;
      const from = sq(ff, fromRank);
      if (b[from] !== c * P) return false;
      let epCap = -1;
      if (b[to] * c < 0) {
        /* normal capture */
      } else if (to === this.ep && b[to] === 0) epCap = sq(tf, fromRank);
      else return false;
      if (!this.safe(from, to, epCap)) return false;
      this.doMove(from, to, epCap, promo);
      return true;
    }
    if (b[to] !== 0) return false;
    let from = sq(ff, fromRank);
    if (b[from] !== c * P) {
      const start = c === 1 ? 3 : 4; // rank index of a double push target
      const from2 = sq(ff, fromRank - c);
      if (tr !== start || b[from] !== 0 || b[from2] !== c * P) return false;
      from = from2;
    }
    if (!this.safe(from, to, -1)) return false;
    this.doMove(from, to, -1, promo);
    return true;
  }
}

export interface ReplayCheck {
  /** Every move is legal in standard chess from the initial position. */
  legal: boolean;
  /** Some "+"/"#" suffix contradicts the position (a variant written in SAN). */
  badMarks: boolean;
}

/** Validate a SAN move list. Fast path in FastBoard; rejections are confirmed with chess.js. */
export function replayCheck(moves: readonly string[]): ReplayCheck {
  const fb = new FastBoard();
  let badMarks = false;
  for (let i = 0; i < moves.length; i++) {
    const r = fb.playSan(moves[i]);
    if (r === "badmark") badMarks = true;
    else if (r === "illegal") return { legal: chessJsLegal(moves), badMarks };
  }
  return { legal: true, badMarks };
}

/** Full chess.js replay; the slow but authoritative check (only used for rejected games). */
export function chessJsLegal(moves: readonly string[]): boolean {
  const c = new Chess();
  for (const m of moves) {
    try {
      c.move(m);
    } catch {
      return false;
    }
  }
  return true;
}
