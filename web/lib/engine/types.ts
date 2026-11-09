/**
 * Shared contracts for Chess Canopy. Mirrors the Python package
 * (chess_explorer/import_games.py parse_game, storage.py schema v1).
 */

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
  /** lichess incremental sync: ms timestamp of newest game */
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
  min_my_rating?: number | null;
  max_my_rating?: number | null;
  min_opponent_rating?: number | null;
  max_opponent_rating?: number | null;
  /**
   * Move-slice filter: applied as `game.moves.slice(moves_start ?? 0, moves_end ?? undefined)`,
   * i.e. a 0-based half-move (ply) slice with exclusive end, exactly like Python `moves[start:end]`.
   */
  moves_start?: number | null;
  moves_end?: number | null;
}

export interface NextMove {
  move: string;
  stats: Stats;
}

export interface QueryResult {
  player: string;
  /** Color whose trie was used (may be auto-picked) */
  color?: Color;
  games: number;
  path: string[];
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
}

export interface ImportProgress {
  phase: "fetching" | "parsing" | "saving" | "done" | "error";
  done: number;
  total: number | null;
  added: number;
  duplicates: number;
  message?: string;
}

export type ImportRequest =
  | { kind: "chess.com" | "lichess"; username: string }
  | { kind: "pgn"; username: string; text: string }
  | { kind: "json"; username: string; source?: Source; text: string };

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
  playerId: string;
}

/** Worker contract (exposed via Comlink). All calls async. */
export interface ExplorerAPI {
  listPlayers(): Promise<Player[]>;
  deletePlayer(id: string): Promise<void>;
  /** Schema-v1 JSON string */
  exportPlayer(id: string): Promise<string>;
  setSelection(playerIds: string[] | "all", filters: Filters): Promise<SelectionSummary>;
  query(path: string[]): Promise<QueryResult>;
  gamesAt(path: string[], limit: number): Promise<GameSummary[]>;
  opponents(): Promise<string[]>;
  importGames(req: ImportRequest, onProgress: (p: ImportProgress) => void): Promise<ImportOutcome>;
  syncPlayer(id: string, onProgress: (p: ImportProgress) => void): Promise<ImportOutcome>;
  cancelImport(): Promise<void>;
}
