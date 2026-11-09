import type { Color, Game, Source } from "../engine/types";

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const str = (v: unknown): string => (v == null ? "" : String(v));

/**
 * Parse a schema-v1 store (`{version, games}`) or a bare array of games.
 * source/playerId are always set from options. Entries that are not objects, lack a `moves`
 * array of strings, or have a color other than white/black are dropped.
 */
export function parseStoreJson(text: string, opts: { source: Source; playerId: string }): Game[] {
  const data: unknown = JSON.parse(text);
  const list = Array.isArray(data) ? data : (data as { games?: unknown } | null)?.games;
  if (!Array.isArray(list)) throw new Error("Invalid games file: expected {version, games} or an array");
  const out: Game[] = [];
  list.forEach((g: unknown, i) => {
    if (!g || typeof g !== "object") return;
    const r = g as Record<string, unknown>;
    if (!Array.isArray(r.moves)) return;
    if (r.color !== "white" && r.color !== "black") return;
    out.push({
      game_id: r.game_id != null && r.game_id !== "" ? String(r.game_id) : `json-${i}`,
      moves: r.moves.map(String),
      result: str(r.result),
      color: r.color as Color,
      date: str(r.date),
      opponent: str(r.opponent),
      my_rating: num(r.my_rating),
      opponent_rating: num(r.opponent_rating),
      time_control: str(r.time_control),
      time_control_raw: str(r.time_control_raw),
      termination: str(r.termination),
      url: str(r.url),
      source: opts.source,
      playerId: opts.playerId,
    });
  });
  return out;
}
