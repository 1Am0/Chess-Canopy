import { Chess } from "chess.js";

export type OpeningMatch = { eco: string; name: string; family?: string };

type Entry = { eco: string; name: string; family?: string };
type Row = [eco: string, name: string, line: string];

/** Name lookups, built once the (lazily loaded) dataset arrived. */
interface Index {
  /** Exact move order -> entry (also the fallback for lines chess.js cannot replay). */
  byLine: Map<string, Entry>;
  /** Position (FEN without the move counters) -> entry: finds transposed lines. */
  byEpd: Map<string, Entry>;
  count: number;
}

let index: Index | null = null;
let loading: Promise<void> | null = null;
let version = 0;
const subscribers = new Set<() => void>();

/** Strips annotation suffixes such as "+", "#", "!?" from a SAN token. */
function normalizeSan(token: string): string {
  return token.replace(/[!?+#]+$/g, "");
}

/** The position part of a FEN that identifies it regardless of move counters. */
function epdOf(fen: string): string {
  return fen.split(" ", 4).join(" ");
}

function entryOf(eco: string, name: string): Entry {
  const colon = name.indexOf(":");
  const entry: Entry = { eco, name };
  if (colon > 0) entry.family = name.slice(0, colon).trim();
  return entry;
}

/**
 * Index the rows. Line keys are normalized like the query ("Bb5+" -> "Bb5"); check marks
 * follow from the position, so normalized keys stay unique. The first row wins when two share
 * a line. For positions reached by several lines (transposition aliases) the shortest line
 * wins, then the first row. Rows are replayed with chess.js in sorted order so consecutive
 * lines share their common prefix (undo back instead of replaying), which keeps this to
 * a few thousand moves instead of ~25,000.
 */
export function buildIndex(rows: Row[]): Index {
  const tokens = rows.map(([, , line]) => line.split(" ").filter(Boolean));
  const byLine = new Map<string, Entry>();
  const entries = rows.map(([eco, name]) => entryOf(eco, name));
  tokens.forEach((t, i) => {
    const key = t.map(normalizeSan).join(" ");
    if (!byLine.has(key)) byLine.set(key, entries[i]);
  });

  const finalEpd: Array<string | undefined> = new Array(rows.length);
  const chess = new Chess();
  const played: string[] = [];
  const epds: string[] = [];
  const order = rows.map((_, i) => i).sort((a, b) => {
    const x = tokens[a].join(" ");
    const y = tokens[b].join(" ");
    return x < y ? -1 : x > y ? 1 : a - b;
  });
  for (const i of order) {
    const t = tokens[i];
    let k = 0;
    while (k < played.length && k < t.length && played[k] === t[k]) k++;
    while (played.length > k) {
      chess.undo();
      played.pop();
      epds.pop();
    }
    let ok = t.length > 0;
    for (let j = k; ok && j < t.length; j++) {
      try {
        chess.move(t[j]);
      } catch {
        ok = false;
        break;
      }
      played.push(t[j]);
      epds.push(epdOf(chess.fen()));
    }
    if (ok) finalEpd[i] = epds[t.length - 1];
  }

  const byEpd = new Map<string, Entry>();
  const bestLen = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const epd = finalEpd[i];
    if (!epd) continue;
    const len = tokens[i].length;
    const prev = bestLen.get(epd);
    if (prev === undefined || len < prev) {
      byEpd.set(epd, entries[i]);
      bestLen.set(epd, len);
    }
  }
  return { byLine, byEpd, count: rows.length };
}

/** Starts (once) loading the dataset in its own chunk and notifies subscribers when ready. */
export function loadOpenings(): Promise<void> {
  if (index) return Promise.resolve();
  loading ??= import("./openings.json")
    .then((mod) => {
      const data = mod as unknown as { default?: { openings: Row[] }; openings?: Row[] };
      index = buildIndex((data.default?.openings ?? data.openings ?? []) as Row[]);
      version++;
      for (const cb of [...subscribers]) cb();
    })
    .catch(() => {
      loading = null; // a later lookup retries
    });
  return loading;
}

/** useSyncExternalStore pair: `openingsVersion` changes when the dataset has loaded. */
export function subscribeOpenings(cb: () => void): () => void {
  subscribers.add(cb);
  void loadOpenings();
  return () => {
    subscribers.delete(cb);
  };
}
export function openingsVersion(): number {
  return version;
}

// Lookup board: follows the queried line incrementally (undo to the common prefix, play the
// rest), so the move table's per-row lookups ([...line, move]) cost one move each.
const board = new Chess();
const boardMoves: string[] = [];
const boardEpds: string[] = [];

/** EPDs after each of the leading legal moves of `moves` (shorter than `moves` at an illegal move). */
function epdsAlong(moves: string[]): string[] {
  let k = 0;
  while (k < boardMoves.length && k < moves.length && boardMoves[k] === moves[k]) k++;
  while (boardMoves.length > k) {
    board.undo();
    boardMoves.pop();
    boardEpds.pop();
  }
  for (let i = k; i < moves.length; i++) {
    try {
      board.move(moves[i]);
    } catch {
      break;
    }
    boardMoves.push(moves[i]);
    boardEpds.push(epdOf(board.fen()));
  }
  return boardEpds.slice(0, moves.length);
}

/**
 * The opening of the position after `moves` (SAN tokens, no move numbers): the latest
 * position along the line that is a named opening, whatever move order reached it, so
 * transpositions (1.Nf3 d5 2.d4 -> Queen's Pawn) are named too. Returns null until the
 * dataset has loaded (it starts loading on first use; `useOpeningsVersion` re-renders), and
 * when even the first move is unknown.
 */
export function lookupOpening(moves: string[]): OpeningMatch | null {
  void loadOpenings();
  if (!index) return null;
  if (moves.length === 0) return null;
  const { byLine, byEpd } = index;

  const epds = epdsAlong(moves);
  for (let i = epds.length - 1; i >= 0; i--) {
    const entry = byEpd.get(epds[i]);
    if (entry) return { ...entry };
  }

  // Lines chess.js cannot replay fall back to the old exact-prefix match.
  let key = "";
  const keys: string[] = [];
  for (let i = 0; i < moves.length; i++) {
    const token = normalizeSan(moves[i]);
    key = i === 0 ? token : `${key} ${token}`;
    keys.push(key);
  }
  for (let i = keys.length - 1; i >= 0; i--) {
    const entry = byLine.get(keys[i]);
    if (entry) return { ...entry };
  }
  return null;
}

/** Number of opening rows in the dataset (0 until it has loaded). */
export function openingCount(): number {
  return index?.count ?? 0;
}
