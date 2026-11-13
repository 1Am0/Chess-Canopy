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

/** Shortest segment (percent) that gets a printed label; smaller ones only have the hover title. */
export const BAR_LABEL_MIN = 15;

/** Label for a result-bar segment: none under 15%, digits up to 24%, then digits with "%". */
export function barLabel(p: number): string | null {
  if (p < BAR_LABEL_MIN) return null;
  const n = Math.round(p);
  return p >= 24 ? `${n}%` : String(n);
}

/**
 * Score chip colour on a continuous scale: 30% or less is a soft red, 50% a neutral sand,
 * 70% or more a soft green, mixed in between. All three ends are light, so the dark ink text
 * on top stays well above AA.
 */
export function scoreChipColor(sc: number): string {
  const k = Math.min(1, Math.max(0, (sc - 0.3) / 0.4));
  const loss = "oklch(0.83 0.09 28)";
  const mid = "oklch(0.91 0.035 92)";
  const win = "oklch(0.83 0.12 152)";
  return k < 0.5
    ? `color-mix(in oklab, ${loss} ${Math.round((1 - k * 2) * 100)}%, ${mid})`
    : `color-mix(in oklab, ${win} ${Math.round((k - 0.5) * 200)}%, ${mid})`;
}

/** A score is "clearly good" from 60% on, with enough games to mean something. */
export function isGoodScore(sc: number, total: number): boolean {
  return total >= 3 && sc >= 0.6;
}

/** Player-perspective score color: win text at >= 55%, loss text at <= 45%. */
export function scoreTextClass(sc: number, total: number): string {
  if (!total) return "text-muted-foreground";
  return sc >= 0.55 ? "text-win-text" : sc <= 0.45 ? "text-loss-text" : "text-foreground";
}
