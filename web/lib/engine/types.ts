/**
 * Shared contracts for Chess Canopy. Mirrors the Python package
 * (chess_explorer/import_games.py parse_game, storage.py schema v1).
 */
import type { CanopyRequest, CanopyTree } from "../canopy/types";

export type Source = "chess.com" | "lichess" | "pgn" | "json";

/** Result from the PLAYER's perspective: "1-0" = player won, "0-1" = player lost. */
export type GameResult = "1-0" | "0-1" | "1/2-1/2";

export type Color = "white" | "black";

export type TimeControl = "bullet" | "blitz" | "rapid" | "classical" | "daily";

export interface Game {
  game_id: string;
  /** SAN moves, e.g. ["e4", "c5", "Nf3"] */
  moves: string[];
  /** Player's perspective. Typed loosely as string for imported data; normalized to GameResult. */
  result: string;
  /** Color the player had */
  color: Color;
  /** YYYY-MM-DD */
  date: string;
  opponent: string;
  my_rating: number | null;
  opponent_rating: number | null;
  /** bullet | blitz | rapid | classical | daily (may be "" / other for unknown) */
  time_control: string;
  /** Raw time control string, e.g. "180+2", "600", "1/86400" */
  time_control_raw: string;
  termination: string;
  url: string;
  source: Source;
  /** "source:username", lowercased */
  playerId: string;
}

/** Schema v1 file (compatible with Python storage.py). source/playerId are optional on disk. */
export interface GameStore {
  version: 1;
  games: Array<Omit<Game, "source" | "playerId"> & Partial<Pick<Game, "source" | "playerId">>>;
}

export interface Player {
  /** "source:username", lowercased */
  id: string;
  source: Source;
  username: string;
  displayName: string;
  gameCount: number;
  lastSyncedAt: number | null;
  /** chess.com incremental sync: "YYYY/MM" of last fetched archive */
  lastSyncedMonth?: string;
  /**
   * lichess incremental sync: every finished game created at or before this ms timestamp
   * is stored (the next sync asks for `since = lastGameTs + 1`). Never passes an ongoing
   * game or a game that was not durably saved.
   */
  lastGameTs?: number;
}

export interface Stats {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  /** Fractions in [0, 1] */
  winRate: number;
  drawRate: number;
  lossRate: number;
}

/** All filters optional/nullable. Semantics port filter_games.py. */
export interface Filters {
  color?: Color | null;
  /** Player-perspective result */
  result?: GameResult | null;
  /** Case-insensitive opponent name match */
  opponent?: string | null;
  time_control?: string | null;
  time_control_raw?: string | null;
  /** Inclusive, YYYY-MM-DD */
  date_from?: string | null;
  date_to?: string | null;
  /**
   * Rolling "last N days" window, resolved to `date_from` (UTC) each time the selection is
   * applied, so a persisted preset keeps rolling instead of freezing at the day it was set.
   */
  date_preset?: number | null;
  min_my_rating?: number | null;
  max_my_rating?: number | null;
  min_opponent_rating?: number | null;
  max_opponent_rating?: number | null;
  /**
   * Move-slice filter: applied as `game.moves.slice(moves_start ?? 0, moves_end ?? undefined)`,
   * i.e. a 0-based half-move (ply) slice with exclusive end, exactly like Python `moves[start:end]`.
   * Engine/CLI parity only: the web UI never sets these (a start slice detaches the tree from
   * the start position the board shows).
   */
  moves_start?: number | null;
  moves_end?: number | null;
}

export interface NextMove {
  move: string;
  stats: Stats;
}

export interface QueryResult {
  /** Debug label: the selection key ("all" or the sorted player ids). The UI does not use it. */
  player: string;
  /** Color whose trie was used (may be auto-picked); absent when the selection has no games */
  color?: Color;
  /** Number of games in the selection after filters */
  games: number;
  path: string[];
  /** FEN after `path` (the start position when `path` is empty or not playable) */
  fen: string;
  stats: Stats;
  /** Sorted by total desc, then move */
  next: NextMove[];
}

export interface GameSummary {
  game_id: string;
  date: string;
  opponent: string;
  my_rating: number | null;
  opponent_rating: number | null;
  result: string;
  color: Color;
  url: string;
  source: Source;
  time_control: string;
  /** The game's full move list (SAN), so the UI can load it into the line. */
  moves: string[];
}

export interface ImportProgress {
  phase: "fetching" | "parsing" | "saving" | "done" | "error";
  done: number;
  total: number | null;
  added: number;
  duplicates: number;
  /** Games dropped as not standard chess (variants, custom start positions, illegal moves). */
  skipped?: number;
  /** Games dropped because they have no result yet. */
  unfinished?: number;
  message?: string;
}

export type ImportRequest =
  | { kind: "chess.com" | "lichess"; username: string }
  /**
   * Provide `text`, or a `file`/Blob that the worker reads itself (a Blob is a cheap clone,
   * so a huge PGN is never read or copied on the main thread).
   */
  | { kind: "pgn"; username: string; text?: string; file?: Blob }
  | { kind: "json"; username: string; source?: Source; text?: string; file?: Blob };

export interface Opening {
  eco: string;
  name: string;
  moves: string[];
}

export interface SelectionSummary {
  games: number;
  counts: { white: number; black: number };
}

export interface ImportOutcome {
  added: number;
  total: number;
  /** The main player imported into (the largest group for a multi-player JSON export). */
  playerId: string;
  /** Every player that received games (a re-imported export keeps each game's original player). */
  playerIds?: string[];
  /** Games dropped as not standard chess. */
  skipped?: number;
  /** Games dropped because they have no result yet (`*`). */
  unfinished?: number;
  /**
   * Set when the import stopped early (e.g. one chess.com month kept failing) after saving
   * part of the games. Holds a user-readable summary; the saved games are kept and Sync resumes.
   */
  partial?: string;
}

/** Worker contract (exposed via Comlink). All calls async. */
export interface ExplorerAPI {
  listPlayers(): Promise<Player[]>;
  deletePlayer(id: string): Promise<void>;
  /** Schema-v1 JSON string */
  exportPlayer(id: string): Promise<string>;
  setSelection(playerIds: string[] | "all", filters: Filters): Promise<SelectionSummary>;
  query(path: string[]): Promise<QueryResult>;
  /** Games that reached `path`, newest first: `limit` of them starting at `offset` (default 0). */
  gamesAt(path: string[], limit: number, offset?: number): Promise<GameSummary[]>;
  /** Drop cached games and trees (another tab changed the data). Call setSelection afterwards. */
  invalidate?(): Promise<void>;
  /** Opening tree below `req.path` for the Canopy view (budgeted; ask again while !complete). */
  canopy?(req: CanopyRequest): Promise<CanopyTree>;
  /** The game behind a canopy leaf; null when `key` is stale. */
  canopyGame?(key: string, leafRef: number): Promise<GameSummary | null>;
  opponents(): Promise<string[]>;
  importGames(req: ImportRequest, onProgress: (p: ImportProgress) => void): Promise<ImportOutcome>;
  syncPlayer(id: string, onProgress: (p: ImportProgress) => void): Promise<ImportOutcome>;
  cancelImport(): Promise<void>;
}
