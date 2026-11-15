import type { Color, Stats } from "@/lib/engine/types";
import type { MoveUsage, Verdict } from "@/lib/repertoire/types";

/** The position part of a FEN (the first four fields): the key report positions and saved moves use. */
export function epdOf(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

/** "6." for White's move 6, "6…" for Black's. */
export function moveNumberLabel(moveNumber: number, side: Color): string {
  return side === "white" ? `${moveNumber}.` : `${moveNumber}…`;
}

/** SAN with move numbers, starting at ply `from`: "5. O-O Be7 6. Re1", or "5… Be7 6. Re1" when it starts on a Black move. */
export function numberedLine(line: readonly string[], from = 0): string {
  const out: string[] = [];
  for (let i = from; i < line.length; i++) {
    const n = Math.floor(i / 2) + 1;
    if (i % 2 === 0) out.push(`${n}. ${line[i]}`);
    else if (i === from) out.push(`${n}… ${line[i]}`);
    else out.push(line[i]);
  }
  return out.join(" ");
}

/** The last `n` moves of a line ("… 5. O-O Be7 6. Re1") and the whole line (for a title). */
export function lineTail(line: readonly string[], n = 4): { short: string; full: string } {
  const full = line.length ? numberedLine(line) : "Starting position";
  if (line.length <= n) return { short: full, full };
  return { short: `… ${numberedLine(line, line.length - n)}`, full };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-03-03" -> "3 Mar 2026" (no Date parsing, so no time-zone shifts). */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso || "–";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** Your results with a move as explorer Stats (for WdbBar). */
export function usageStats(m: Pick<MoveUsage, "wins" | "draws" | "losses" | "games">): Stats {
  const total = m.games || m.wins + m.draws + m.losses;
  const t = total || 1;
  return { wins: m.wins, draws: m.draws, losses: m.losses, total, winRate: m.wins / t, drawRate: m.draws / t, lossRate: m.losses / t };
}

/** "−1.3" for a loss of 130 centipawns (pawns, with a real minus sign). */
export function lossLabel(lossCp: number): string {
  return `−${(Math.abs(lossCp) / 100).toFixed(1)}`;
}

/** How the engine's verdict reads inside a sentence: "a mistake", "dubious". */
export function verdictPhrase(v: Verdict): string {
  return v === "bad" ? "a mistake" : v === "dubious" ? "dubious" : v === "good" ? "fine" : "unknown";
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
