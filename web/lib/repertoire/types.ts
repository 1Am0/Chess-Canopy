/**
 * Shared contract for the Repertoire page (web/app/repertoire).
 *
 * The page answers two questions about one side (White or Black) of the selected players' games:
 * which openings are settled and can be left alone, and where the player keeps choosing different
 * moves (or plays a move the engine dislikes). It also stores the player's chosen "repertoire move"
 * per position, which a later training page will drill.
 *
 * Positions are keyed by EPD (the first four FEN fields), so the same position reached by a
 * different move order is one position.
 */
import type { CloudEval } from "../cloud-eval";
import type { Color, GameSummary } from "../engine/types";

// ---- tuning (shared by the worker, the eval queue and the UI) ----

/** Default last full move number analysed: your moves up to and including move 12. */
export const DEFAULT_MAX_MOVE = 12;
/** Choices offered by the page's depth picker. */
export const MAX_MOVE_CHOICES = [8, 10, 12, 15, 20] as const;
/** Default time window: only games from the last year count. */
export const DEFAULT_PERIOD_DAYS = 365;
/** Choices offered by the page's period picker (days back; null = all time). */
export const PERIOD_CHOICES: readonly { days: number | null; label: string }[] = [
  { days: 90, label: "Last 3 months" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last year" },
  { days: 730, label: "Last 2 years" },
  { days: null, label: "All time" },
];
/** Positions you reached fewer times than this are left out of the report. */
export const MIN_GAMES = 3;
/** A position is "consistent" when your main move has at least this share of its current games. */
export const CONSISTENT_SHARE = 0.8;
/** Clean switch: from some date on, at least this share of games use the new move ... */
export const SWITCH_SHARE = 0.9;
/** ... and at least this many games were played since that date. */
export const SWITCH_MIN_GAMES = 5;
/** Engine verdict thresholds, in centipawns lost compared with the position before your move. */
export const DUBIOUS_CP = 50;
export const BAD_CP = 100;
/** Moves played fewer times than this are not sent to the engine (the top move always is). */
export const EVAL_MIN_MOVE_GAMES = 2;
/** At most this many "left your repertoire" games are returned. */
export const MAX_DEVIATIONS = 50;

// ---- worker side (ExplorerService) ----

export interface RepertoireOptions {
  side: Color;
  /**
   * "bullet" | "blitz" | "rapid" | "classical" | "daily" to use only that time control, null for all games,
   * or "auto" to use the time control with the most games on this side (the report says which one it used).
   */
  timeControl: string | null | "auto";
  /** Last full move number analysed (12 = your moves up to and including move 12). */
  maxMove: number;
  /** Only games from the last N days count (null or omitted = all time). Applies to the time-control counts too. */
  periodDays?: number | null;
}

export interface MoveUsage {
  /** chess.js SAN */
  san: string;
  /** Games in which you played this move here (all of them, including ones from before a switch). */
  games: number;
  /** Your results in those games. */
  wins: number;
  draws: number;
  losses: number;
  /** YYYY-MM-DD of the oldest and newest such game. */
  firstDate: string;
  lastDate: string;
  /** FEN after the move (the engine evaluates it). */
  fenAfter: string;
}

export interface MoveSwitch {
  /** The move you used to play (the most common move before `date`). */
  from: string;
  /** The move you play now. */
  to: string;
  /** YYYY-MM-DD of the first game of the new period. */
  date: string;
  /** Games from `date` on. */
  gamesSince: number;
}

export interface DecisionPoint {
  /** Position key: the first four FEN fields. */
  epd: string;
  /** Full FEN of the position (you are to move). */
  fen: string;
  /** The most common move sequence that reached this position (chess.js SAN), for display and "open in explorer". */
  line: string[];
  /** Full-move number of your move here (1 = your first move). */
  moveNumber: number;
  /** Games in which you reached this position with you to move, within the analysed depth (each game counted once). */
  games: number;
  /** Every move you played here, most games first. */
  moves: MoveUsage[];
  /**
   * The move this position is judged by: the locked repertoire move if there is one,
   * else the switch's `to` move, else the most-played move.
   */
  main: string;
  /** Share (0..1) of the current games that used `main`; "current" = games since the switch, or all games when there is none. */
  consistency: number;
  switch: MoveSwitch | null;
  /** current games × (1 − consistency): how much an unsettled choice costs. 0 when fully consistent. */
  priority: number;
  /** SAN of your locked repertoire move here, or null. */
  locked: string | null;
}

export interface Deviation {
  epd: string;
  /** Moves of the game up to (not including) your deviating move. */
  line: string[];
  /** Your locked move here. */
  expected: string;
  /** What you played instead. */
  played: string;
  game: GameSummary;
}

export interface RepertoireReport {
  side: Color;
  /** The time control actually used (null = all), after resolving "auto". */
  timeControl: string | null;
  maxMove: number;
  /** The time window used (null = all time). */
  periodDays: number | null;
  /** Games of this side (and time control) that were analysed. */
  games: number;
  /** Positions with at least MIN_GAMES games, sorted by priority desc, then games desc, then moveNumber asc. */
  points: DecisionPoint[];
  /**
   * Games where you reached a position with a locked move and played something else, only games dated on or after
   * the day the move was locked; newest first, at most MAX_DEVIATIONS.
   */
  deviations: Deviation[];
  /** Games per time control on this side for the selected players within the period (ignoring the time-control choice), most first. */
  timeControls: { timeControl: string; games: number }[];
}

/** A saved repertoire move. One repertoire per browser per side, shared by every imported player. */
export interface RepertoireEntry {
  /** `${side}|${epd}` */
  id: string;
  side: Color;
  epd: string;
  /** FEN of the position (you are to move). */
  fen: string;
  /** Your move here (chess.js SAN). */
  san: string;
  /** A line that reaches the position (for display and the board). */
  line: string[];
  /** ms timestamp of when the move was locked (re-locking a different move updates it). */
  lockedAt: number;
}

export type NewRepertoireEntry = Omit<RepertoireEntry, "id" | "lockedAt">;

// ---- page side (engine verdicts) ----

export type Verdict = "good" | "dubious" | "bad" | "unknown";

export interface MoveEval {
  san: string;
  /** Eval after the move, White's point of view; null when no eval could be had. */
  after: CloudEval | null;
  /** Centipawns lost compared with the position before the move, from your point of view (>= 0); null when unknown. */
  lossCp: number | null;
  verdict: Verdict;
}

/**
 * - settled: consistent, and the main move is good → leave it alone
 * - leaking: consistent, but the engine says the main move is dubious or bad → consider changing it
 * - undecided: not consistent, and every evaluated move is fine → pick one
 * - problem: not consistent, and a move with ≥ 20% of the current games is dubious or bad → fix first
 * - pending: the engine verdict for the main move is not in yet (judged on consistency only until it is)
 */
export type PointStatus = "settled" | "leaking" | "undecided" | "problem" | "pending";

export interface PointEval {
  epd: string;
  /** Eval of the position before your move, White's point of view. */
  before: CloudEval | null;
  /** By SAN. Only moves that were sent to the engine (see EVAL_MIN_MOVE_GAMES) are present. */
  moves: Record<string, MoveEval>;
  status: PointStatus;
}

/** Wording used on the page (one place, so every component says the same thing). */
export const STATUS_LABEL: Record<PointStatus, string> = {
  settled: "Settled",
  leaking: "Consistent, engine disagrees",
  undecided: "Undecided",
  problem: "Problem spot",
  pending: "Waiting for the engine",
};

export const STATUS_HINT: Record<PointStatus, string> = {
  settled: "You always play the same move and the engine is happy with it. Leave it alone.",
  leaking: "You always play the same move, but the engine says it gives something away.",
  undecided: "You switch between moves here. They are all fine, so pick one.",
  problem: "You switch between moves here and at least one of them is a mistake.",
  pending: "The engine hasn't checked this position yet.",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  good: "Fine",
  dubious: "Dubious",
  bad: "Mistake",
  unknown: "No eval",
};
