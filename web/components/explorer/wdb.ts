import type { Color, Stats } from "@/lib/engine/types";

/** Game counts in the chess convention: White wins / Draws / Black wins. */
export interface Wdb {
  white: number;
  draw: number;
  black: number;
  total: number;
}

/**
 * Explorer stats are from the player's side (wins = the player's wins). Bars use the
 * chess convention instead: White wins = side === "white" ? wins : losses, and so on.
 */
export function toWdb(stats: Stats, side: Color): Wdb {
  return side === "white"
    ? { white: stats.wins, draw: stats.draws, black: stats.losses, total: stats.total }
    : { white: stats.losses, draw: stats.draws, black: stats.wins, total: stats.total };
}

/** Whole-number percentages of a Wdb split (0 when there are no games). */
export function wdbPercents(w: Wdb): { white: number; draw: number; black: number } {
  const t = w.total || 1;
  return { white: (w.white / t) * 100, draw: (w.draw / t) * 100, black: (w.black / t) * 100 };
}

/** "White 49% · Draw 8% · Black 43%" */
export function wdbLabel(w: Wdb): string {
  if (!w.total) return "No games";
  const p = wdbPercents(w);
  return `White ${Math.round(p.white)}% · Draw ${Math.round(p.draw)}% · Black ${Math.round(p.black)}%`;
}

/**
 * Bar segment label rule (Lichess): no text up to 12%, digits only up to 20%,
 * then digits with "%".
 */
export function segmentLabel(p: number): string | null {
  if (p <= 12) return null;
  const n = Math.round(p);
  return p > 20 ? `${n}%` : String(n);
}

/** Player-perspective score color: win text at >= 55%, loss text at <= 45%. */
export function scoreTextClass(sc: number, total: number): string {
  if (!total) return "text-muted-foreground";
  return sc >= 0.55 ? "text-win-text" : sc <= 0.45 ? "text-loss-text" : "text-foreground";
}
