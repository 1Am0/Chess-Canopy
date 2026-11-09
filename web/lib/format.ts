import type { Source, Stats } from "@/lib/engine/types";

export function pct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "–";
  return `${(n * 100).toFixed(digits)}%`;
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

/** Score = (wins + draws / 2) / total, from the player's perspective. */
export function score(stats: Stats): number {
  return stats.total ? (stats.wins + stats.draws / 2) / stats.total : 0;
}

export function sourceLabel(source: Source): string {
  switch (source) {
    case "chess.com":
      return "chess.com";
    case "lichess":
      return "lichess";
    case "pgn":
      return "PGN";
    default:
      return "JSON";
  }
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * The UTC calendar date `days` days ago, "YYYY-MM-DD". Game dates are UTC (chess.com
 * end_time, Lichess createdAt, PGN UTCDate), so presets are computed in UTC as well.
 */
export function isoDaysAgo(days: number, now: number = Date.now()): string {
  return new Date(now - days * 86_400_000).toISOString().slice(0, 10);
}

export function resultLabel(result: string): "Win" | "Draw" | "Loss" {
  if (result === "1-0") return "Win";
  if (result === "0-1") return "Loss";
  return "Draw";
}

export function splitOpeningName(name: string): string[] {
  return name
    .split(/[:,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface TrailEntry {
  index: number;
  san: string;
  /** "1." for white moves, "1…" for a black move that starts the line */
  number: string | null;
}

export function buildTrail(path: string[]): TrailEntry[] {
  return path.map((san, index) => {
    const moveNo = Math.floor(index / 2) + 1;
    const white = index % 2 === 0;
    return { index, san, number: white ? `${moveNo}.` : index === 0 ? `${moveNo}…` : null };
  });
}
