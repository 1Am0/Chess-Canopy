/**
 * In-memory ExplorerAPI used until the Web Worker engine is wired in.
 * Fully self-contained: a handful of real opening lines, seeded synthetic games,
 * and naive counting for queries.
 */
import { Chess } from "chess.js";
import type {
  Color,
  ExplorerAPI,
  Filters,
  Game,
  GameSummary,
  ImportOutcome,
  ImportProgress,
  ImportRequest,
  NextMove,
  Player,
  QueryResult,
  SelectionSummary,
  Source,
  Stats,
} from "@/lib/engine/types";

const LINES: string[] = [
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7",
  "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6",
  "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6",
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7",
  "e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6",
  "e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 f4 c5",
  "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6",
  "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O",
  "d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5",
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O",
  "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5",
  "d4 Nf6 Bf4 d5 e3 c5 c3 Nc6 Nd2 e6",
  "Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 d3 O-O",
  "c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5",
];
// weights: e4 lines are more common
const WEIGHTS = [6, 4, 2, 7, 5, 2, 3, 2, 4, 2, 3, 2, 2, 2, 1];

const TIME_CONTROLS = [
  { label: "blitz", raw: "180+2" },
  { label: "blitz", raw: "300" },
  { label: "rapid", raw: "600+5" },
  { label: "bullet", raw: "60" },
];
const OPPONENTS = [
  "knightrider", "pawnstorm77", "queenside_castle", "endgame_ed", "tactician42", "rookie_ro", "fianchetto_fan",
  "zugzwang", "bishop_pair", "gambit_gary", "slowplay", "blunderbuss", "openfile", "prophylaxis", "kingwalk",
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function buildGames(source: Source, username: string, count: number, seed: number): Game[] {
  const rnd = mulberry32(seed);
  const playerId = `${source}:${username.toLowerCase()}`;
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  const games: Game[] = [];
  const base = Date.UTC(2025, 0, 1);
  for (let i = 0; i < count; i++) {
    let r = rnd() * total;
    let li = 0;
    for (; li < WEIGHTS.length; li++) {
      r -= WEIGHTS[li];
      if (r <= 0) break;
    }
    const line = LINES[Math.min(li, LINES.length - 1)].split(" ");
    const len = 6 + Math.floor(rnd() * 5);
    const color: Color = rnd() < 0.55 ? "white" : "black";
    const roll = rnd();
    const bias = color === "white" ? 0.5 : 0.42;
    const result = roll < bias ? "1-0" : roll < bias + 0.1 ? "1/2-1/2" : "0-1";
    const tc = TIME_CONTROLS[Math.floor(rnd() * TIME_CONTROLS.length)];
    const date = new Date(base + Math.floor(rnd() * 600) * 86_400_000).toISOString().slice(0, 10);
    const id = `${seed}-${i}`;
    const my = 1450 + Math.floor(rnd() * 250);
    games.push({
      game_id: id,
      moves: line.slice(0, len),
      result,
      color,
      date,
      opponent: OPPONENTS[Math.floor(rnd() * OPPONENTS.length)],
      my_rating: my,
      opponent_rating: my + Math.floor((rnd() - 0.5) * 300),
      time_control: tc.label,
      time_control_raw: tc.raw,
      termination: "Normal",
      url: source === "lichess" ? `https://lichess.org/${id.replace(/\W/g, "").padEnd(8, "x").slice(0, 8)}` : `https://www.chess.com/game/live/${1000000 + i}`,
      source,
      playerId,
    });
  }
  return games;
}

function emptyStats(): Stats {
  return { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0, drawRate: 0, lossRate: 0 };
}
function addResult(s: Stats, result: string) {
  if (result === "1-0") s.wins++;
  else if (result === "0-1") s.losses++;
  else s.draws++;
  s.total++;
}
function finish(s: Stats): Stats {
  if (s.total) {
    s.winRate = s.wins / s.total;
    s.drawRate = s.draws / s.total;
    s.lossRate = s.losses / s.total;
  }
  return s;
}

function matches(g: Game, f: Filters): boolean {
  if (f.color && g.color !== f.color) return false;
  if (f.result && g.result !== f.result) return false;
  if (f.opponent && g.opponent.toLowerCase() !== f.opponent.toLowerCase()) return false;
  if (f.time_control && g.time_control !== f.time_control) return false;
  if (f.time_control_raw && g.time_control_raw !== f.time_control_raw) return false;
  if (f.date_from && g.date < f.date_from) return false;
  if (f.date_to && g.date > f.date_to) return false;
  if (f.min_my_rating != null && (g.my_rating == null || g.my_rating < f.min_my_rating)) return false;
  if (f.max_my_rating != null && (g.my_rating == null || g.my_rating > f.max_my_rating)) return false;
  if (f.min_opponent_rating != null && (g.opponent_rating == null || g.opponent_rating < f.min_opponent_rating)) return false;
  if (f.max_opponent_rating != null && (g.opponent_rating == null || g.opponent_rating > f.max_opponent_rating)) return false;
  return true;
}

function startsWith(moves: string[], path: string[]): boolean {
  if (moves.length < path.length) return false;
  for (let i = 0; i < path.length; i++) if (moves[i] !== path[i]) return false;
  return true;
}

function fenFor(path: string[]): string {
  const c = new Chess();
  for (const m of path) {
    try {
      c.move(m);
    } catch {
      break;
    }
  }
  return c.fen();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class MockExplorer implements ExplorerAPI {
  private games = new Map<string, Game[]>();
  private players = new Map<string, Player>();
  private ids: string[] | "all" = "all";
  private filters: Filters = {};
  private cancelled = false;

  constructor() {
    this.addPlayer("lichess", "mockmaster", buildGames("lichess", "mockmaster", 48, hash("lichess-mock")));
    this.addPlayer("chess.com", "mockmaster", buildGames("chess.com", "mockmaster", 36, hash("chesscom-mock")));
  }

  private addPlayer(source: Source, username: string, games: Game[]): Player {
    const id = `${source}:${username.toLowerCase()}`;
    const existing = this.games.get(id) ?? [];
    const seen = new Set(existing.map((g) => g.game_id));
    const merged = existing.concat(games.filter((g) => !seen.has(g.game_id)));
    this.games.set(id, merged);
    const p: Player = {
      id,
      source,
      username,
      displayName: username,
      gameCount: merged.length,
      lastSyncedAt: Date.now(),
    };
    this.players.set(id, p);
    return p;
  }

  private selected(): Game[] {
    const ids = this.ids === "all" ? [...this.games.keys()] : this.ids;
    return ids.flatMap((id) => this.games.get(id) ?? []).filter((g) => matches(g, this.filters));
  }

  async listPlayers(): Promise<Player[]> {
    return [...this.players.values()];
  }
  async deletePlayer(id: string): Promise<void> {
    this.players.delete(id);
    this.games.delete(id);
  }
  async exportPlayer(id: string): Promise<string> {
    return JSON.stringify({ version: 1, games: this.games.get(id) ?? [] }, null, 2);
  }
  async setSelection(playerIds: string[] | "all", filters: Filters): Promise<SelectionSummary> {
    this.ids = playerIds;
    this.filters = filters;
    await sleep(40);
    const sel = this.selected();
    return {
      games: sel.length,
      counts: {
        white: sel.filter((g) => g.color === "white").length,
        black: sel.filter((g) => g.color === "black").length,
      },
    };
  }
  async query(path: string[]): Promise<QueryResult> {
    await sleep(30);
    const sel = this.selected();
    let color = this.filters.color ?? undefined;
    if (!color) {
      const w = sel.filter((g) => g.color === "white" && startsWith(g.moves, path)).length;
      const b = sel.filter((g) => g.color === "black" && startsWith(g.moves, path)).length;
      color = b > w ? "black" : "white";
    }
    const reach = sel.filter((g) => g.color === color && startsWith(g.moves, path));
    const stats = emptyStats();
    const byMove = new Map<string, Stats>();
    for (const g of reach) {
      addResult(stats, g.result);
      const m = g.moves[path.length];
      if (m) {
        const s = byMove.get(m) ?? emptyStats();
        addResult(s, g.result);
        byMove.set(m, s);
      }
    }
    const next: NextMove[] = [...byMove.entries()]
      .map(([move, s]) => ({ move, stats: finish(s) }))
      .sort((a, b) => b.stats.total - a.stats.total || a.move.localeCompare(b.move));
    return {
      player: this.ids === "all" ? "all" : this.ids.join(","),
      color,
      games: reach.length,
      path,
      fen: fenFor(path),
      stats: finish(stats),
      next,
    };
  }
  async gamesAt(path: string[], limit: number): Promise<GameSummary[]> {
    const color = this.filters.color;
    return this.selected()
      .filter((g) => (!color || g.color === color) && startsWith(g.moves, path))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit)
      .map((g) => ({
        game_id: g.game_id,
        date: g.date,
        opponent: g.opponent,
        my_rating: g.my_rating,
        opponent_rating: g.opponent_rating,
        result: g.result,
        color: g.color,
        url: g.url,
        source: g.source,
        time_control: g.time_control,
      }));
  }
  async opponents(): Promise<string[]> {
    const all = [...this.games.values()].flat();
    return [...new Set(all.map((g) => g.opponent))].sort();
  }

  private async simulate(
    source: Source,
    username: string,
    onProgress: (p: ImportProgress) => void,
  ): Promise<ImportOutcome> {
    this.cancelled = false;
    const generated = buildGames(source, username, 20 + (hash(username) % 25), hash(`${source}${username}${Date.now()}`));
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      await sleep(140);
      if (this.cancelled) {
        onProgress({ phase: "error", done: i, total: steps, added: 0, duplicates: 0, message: "Cancelled" });
        throw new Error("Import cancelled");
      }
      onProgress({
        phase: "fetching",
        done: i,
        total: steps,
        added: Math.round((generated.length * i) / steps),
        duplicates: 0,
        message: source === "lichess" ? `${i * 40} games streamed` : `Month ${i} of ${steps}`,
      });
    }
    const p = this.addPlayer(source, username, generated);
    onProgress({ phase: "done", done: steps, total: steps, added: generated.length, duplicates: 0 });
    return { added: generated.length, total: p.gameCount, playerId: p.id };
  }

  async importGames(req: ImportRequest, onProgress: (p: ImportProgress) => void): Promise<ImportOutcome> {
    const source: Source = req.kind === "json" ? (req.source ?? "json") : req.kind;
    return this.simulate(source, req.username || "imported", onProgress);
  }
  async syncPlayer(id: string, onProgress: (p: ImportProgress) => void): Promise<ImportOutcome> {
    const p = this.players.get(id);
    if (!p) throw new Error("Unknown player");
    return this.simulate(p.source, p.username, onProgress);
  }
  async cancelImport(): Promise<void> {
    this.cancelled = true;
  }
}

export const mockExplorer: ExplorerAPI = new MockExplorer();
