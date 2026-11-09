import { pyInt } from "./common";

/**
 * Time-control labels (one rule for every importer, kept identical to the Python CLI):
 *
 * - Chess.com games use chess.com's own `time_class` when the source has it (API, CLI JSON).
 * - Lichess games use Lichess's own `speed` (ultraBullet -> bullet, correspondence -> daily);
 *   without it, Lichess thresholds on base + 40*inc: <180 bullet, <480 blitz, <1500 rapid,
 *   else classical (`lichessTimeControlLabel`).
 * - Everything else (generic PGN, JSON without a site label) uses `timeControlLabel`:
 *   empty -> rapid; '/', "-" or "day" -> daily; base + 40*inc >= 86400 daily, <180 bullet,
 *   <600 blitz, <3600 rapid, else classical; unparseable -> rapid.
 */
export const TIME_CONTROL_LABELS = new Set(["bullet", "blitz", "rapid", "classical", "daily"]);

function isDailyRaw(tc: string): boolean {
  return tc.includes("/") || tc.trim() === "-" || /day/i.test(tc);
}

function estimate(tc: string): number | null {
  const parts = tc.split("+");
  const base = pyInt(parts[0]);
  const inc = parts.length > 1 ? pyInt(parts[1]) : 0;
  if (base === null || inc === null) return null;
  return base + 40 * inc;
}

/** Port of Python import_games.time_control_label. */
export function timeControlLabel(tc: string | null | undefined): string {
  if (!tc) return "rapid";
  if (isDailyRaw(tc)) return "daily";
  const total = estimate(tc);
  if (total === null) return "rapid";
  if (total >= 86400) return "daily";
  if (total < 180) return "bullet";
  if (total < 600) return "blitz";
  if (total < 3600) return "rapid";
  return "classical";
}

const LICHESS_SPEEDS: Record<string, string> = {
  ultrabullet: "bullet",
  bullet: "bullet",
  blitz: "blitz",
  rapid: "rapid",
  classical: "classical",
  correspondence: "daily",
};

/** Lichess `speed` (API field or the speed word in a PGN Event like "Rated Blitz game"), or null. */
export function lichessSpeedLabel(speedOrEvent: string | null | undefined): string | null {
  const m = /\b(ultrabullet|bullet|blitz|rapid|classical|correspondence)\b/i.exec(speedOrEvent ?? "");
  return m ? LICHESS_SPEEDS[m[1].toLowerCase()] : null;
}

/** Port of Python import_lichess.lichess_speed_label's threshold fallback. */
export function lichessTimeControlLabel(tc: string | null | undefined): string {
  if (!tc || isDailyRaw(tc)) return "daily";
  const total = estimate(tc);
  if (total === null) return "rapid";
  if (total < 180) return "bullet";
  if (total < 480) return "blitz";
  if (total < 1500) return "rapid";
  return "classical";
}

/** Lichess "N days per move" (older CLI exports) -> "1/<seconds>", the API importer's form. */
export function normalizeLichessRaw(tc: string): string {
  const m = /^\s*(\d+)\s+days?\s+per\s+move\s*$/i.exec(tc);
  return m ? `1/${Number(m[1]) * 86400}` : tc;
}

export function isLichessUrl(url: string | null | undefined): boolean {
  return /^https?:\/\/(?:[a-z0-9-]+\.)?lichess\.org\//i.test(url ?? "");
}

export function isChessComUrl(url: string | null | undefined): boolean {
  return /^https?:\/\/(?:[a-z0-9-]+\.)?chess\.com\//i.test(url ?? "");
}
