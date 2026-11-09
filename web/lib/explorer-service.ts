import { Chess } from "chess.js";
import { buildColorTries, filterGames } from "./engine/filter";
import { emptyStats, nextMovesForPath, type Trie } from "./engine/trie";
import type {
  Color,
  ExplorerAPI,
  Filters,
  Game,
  GameSummary,
  ImportOutcome,
  ImportProgress,
  ImportRequest,
  Player,
  QueryResult,
  SelectionSummary,
  Source,
} from "./engine/types";
import * as dbm from "./db";
import { fetchChessComGames, parseChessComGame } from "./importers/chesscom";
import { fetchLichessGames, parseLichessGame, type LichessRawGame } from "./importers/lichess";
import { parsePgnText } from "./importers/pgn";
import { parseStoreJson } from "./importers/normalize";
import { abortError, HttpError } from "./importers/common";

const LRU_SIZE = 8;
const BATCH = 500;
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface Computed {
  tries: Record<Color, Trie>;
  counts: { white: number; black: number };
  filtered: Game[];
}

function normalizeFilters(f: Filters): Filters {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(f).sort()) {
    const v = (f as Record<string, unknown>)[k];
    if (v === null || v === undefined || v === "") continue;
    out[k] = v;
  }
  return out as Filters;
}

export interface ExplorerServiceOptions {
  fetchImpl?: typeof fetch;
}

export class ExplorerService implements ExplorerAPI {
  fetchImpl?: typeof fetch;
  private lru = new Map<string, Computed>();
  private gamesCache = new Map<string, Game[]>();
  private sel: { ids: string[] | "all"; filters: Filters; key: string } | null = null;
  private abort: AbortController | null = null;

  constructor(opts: ExplorerServiceOptions = {}) {
    this.fetchImpl = opts.fetchImpl;
  }

  private invalidate() {
    this.lru.clear();
    this.gamesCache.clear();
  }

  // ---- players ----
  listPlayers(): Promise<Player[]> {
    return dbm.listPlayers();
  }

  async deletePlayer(id: string): Promise<void> {
    await dbm.deletePlayer(id);
    this.invalidate();
  }

  async exportPlayer(id: string): Promise<string> {
    const games = await dbm.getGamesForPlayers([id]);
    return JSON.stringify({ version: 1, games }, null, 2);
  }

  // ---- selection / query ----
  async setSelection(playerIds: string[] | "all", filters: Filters): Promise<SelectionSummary> {
    const ids = playerIds === "all" ? "all" : [...new Set(playerIds)].sort();
    const idsKey = ids === "all" ? "all" : ids.join(",");
    const nf = normalizeFilters(filters ?? {});
    const key = `${idsKey}::${JSON.stringify(nf)}`;
    this.sel = { ids, filters: nf, key };
    let c = this.lru.get(key);
    if (c) {
      this.lru.delete(key);
    } else {
      let games = this.gamesCache.get(idsKey);
      if (!games) {
        games = await dbm.getGamesForPlayers(ids);
        this.gamesCache.clear();
        this.gamesCache.set(idsKey, games);
      }
      const filtered = filterGames(games, nf);
      const counts = { white: 0, black: 0 };
      for (const g of filtered) if (g.color === "white" || g.color === "black") counts[g.color]++;
      c = { tries: buildColorTries(filtered), counts, filtered };
    }
    this.lru.set(key, c);
    while (this.lru.size > LRU_SIZE) this.lru.delete(this.lru.keys().next().value as string);
    return { games: c.filtered.length, counts: { ...c.counts } };
  }

  private async current(): Promise<{ c: Computed; label: string }> {
    if (!this.sel) throw new Error("No selection set");
    let c = this.lru.get(this.sel.key);
    if (!c) {
      // Cache was invalidated (e.g. an import finished); rebuild for the current selection.
      await this.setSelection(this.sel.ids, this.sel.filters);
      c = this.lru.get(this.sel.key);
    }
    if (!c) throw new Error("Selection is stale; call setSelection again");
    return { c, label: this.sel.ids === "all" ? "all" : this.sel.ids.join(",") };
  }

  private chooseColor(c: Computed): Color {
    const f = this.sel!.filters.color;
    if (f) return f;
    let chosen: Color = c.counts.white >= c.counts.black ? "white" : "black";
    if (c.counts[chosen] === 0) chosen = chosen === "white" ? "black" : "white";
    return chosen;
  }

  async query(path: string[]): Promise<QueryResult> {
    const { c, label } = await this.current();
    if (c.filtered.length === 0) {
      return { player: label, games: 0, path, fen: START_FEN, stats: emptyStats(), next: [] };
    }
    const color = this.chooseColor(c);
    const board = new Chess();
    for (const san of path) {
      try {
        board.move(san);
      } catch {
        throw new Error(`Invalid move sequence: ${san}`);
      }
    }
    const { stats, next } = nextMovesForPath(c.tries[color], path);
    return { player: label, color, games: c.filtered.length, path, fen: board.fen(), stats, next };
  }

  async gamesAt(path: string[], limit: number): Promise<GameSummary[]> {
    const { c } = await this.current();
    if (c.filtered.length === 0) return [];
    const color = this.chooseColor(c);
    const out = c.filtered
      .filter((g) => g.color === color && path.every((m, i) => g.moves[i] === m))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, limit);
    return out.map((g) => ({
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
    if (!this.sel) return [];
    const idsKey = this.sel.ids === "all" ? "all" : this.sel.ids.join(",");
    let games = this.gamesCache.get(idsKey);
    if (!games) {
      games = await dbm.getGamesForPlayers(this.sel.ids);
      this.gamesCache.set(idsKey, games);
    }
    const freq = new Map<string, { name: string; n: number }>();
    for (const g of games) {
      if (!g.opponent) continue;
      const k = g.opponent.toLowerCase();
      const e = freq.get(k);
      if (e) e.n++;
      else freq.set(k, { name: g.opponent, n: 1 });
    }
    return [...freq.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map((e) => e.name);
  }

  // ---- import ----
  async cancelImport(): Promise<void> {
    this.abort?.abort();
  }

  async importGames(req: ImportRequest, onProgress: (p: ImportProgress) => void): Promise<ImportOutcome> {
    const username = req.username.trim();
    if (!username) throw new Error("Enter a username");
    if (req.kind !== "pgn" && req.kind !== "json") {
      return this.runRemote(req.kind, username, null, onProgress);
    }
    const text: string = req.text;
    const source: Source = req.kind === "json" ? (req.source ?? "json") : "pgn";
    const playerId = `${source}:${username.toLowerCase()}`;
    onProgress({ phase: "parsing", done: 0, total: null, added: 0, duplicates: 0 });
    let games: Game[];
    try {
      games =
        req.kind === "pgn"
          ? parsePgnText(text, username).map((g) => ({ ...g, source, playerId }))
          : parseStoreJson(text, { source, playerId });
    } catch (e) {
      throw new Error(`Could not read file: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (games.length === 0) throw new Error("No games found in the file");
    return this.save(
      { id: playerId, source, username: username.toLowerCase(), displayName: username },
      games,
      {},
      onProgress,
    );
  }

  async syncPlayer(id: string, onProgress: (p: ImportProgress) => void): Promise<ImportOutcome> {
    const p = await dbm.getPlayer(id);
    if (!p) throw new Error("Player not found");
    if (p.source !== "chess.com" && p.source !== "lichess") {
      throw new Error("Only Chess.com and Lichess players can be synced");
    }
    return this.runRemote(p.source, p.displayName || p.username, p, onProgress);
  }

  private async runRemote(
    kind: "chess.com" | "lichess",
    username: string,
    existing: Player | null,
    onProgress: (p: ImportProgress) => void,
  ): Promise<ImportOutcome> {
    const ac = new AbortController();
    this.abort = ac;
    const playerId = `${kind}:${username.toLowerCase()}`;
    const base = { id: playerId, source: kind as Source, username: username.toLowerCase(), displayName: username };
    const signal = ac.signal;
    const prog = (p: Partial<ImportProgress> & Pick<ImportProgress, "phase">) =>
      onProgress({ done: 0, total: null, added: 0, duplicates: 0, ...p });
    try {
      if (kind === "chess.com") {
        const r = await fetchChessComGames(username, {
          sinceMonth: existing?.lastSyncedMonth ?? null,
          signal,
          fetchImpl: this.fetchImpl,
          onProgress: (p) => prog({ phase: "fetching", done: p.done, total: p.total }),
        });
        if (signal.aborted) throw abortError();
        prog({ phase: "parsing", total: r.games.length });
        const games: Game[] = [];
        for (const raw of r.games) {
          const g = parseChessComGame(raw, username);
          if (g) games.push({ ...g, playerId, source: "chess.com" });
        }
        return await this.save(base, games, { lastSyncedMonth: r.lastMonth ?? existing?.lastSyncedMonth }, onProgress, signal);
      }
      // lichess: stream and flush in batches so a cancel keeps what was saved
      let added = 0;
      let duplicates = 0;
      let seen = 0;
      let maxTs = existing?.lastGameTs ?? 0;
      let buf: Game[] = [];
      const flush = async () => {
        if (!buf.length) return;
        const r = await dbm.upsertGames(playerId, buf);
        added += r.added;
        duplicates += r.duplicates;
        buf = [];
      };
      try {
        for await (const raw of fetchLichessGames(username, {
          since: existing?.lastGameTs != null ? existing.lastGameTs + 1 : null,
          signal,
          fetchImpl: this.fetchImpl,
        })) {
          seen++;
          const r = raw as LichessRawGame;
          if (typeof r.createdAt === "number" && r.createdAt > maxTs) maxTs = r.createdAt;
          const g = parseLichessGame(r, username);
          if (g) buf.push({ ...g, playerId, source: "lichess" });
          if (seen % 25 === 0) prog({ phase: "fetching", done: seen, total: null, added, duplicates });
          if (buf.length >= BATCH) await flush();
        }
        prog({ phase: "fetching", done: seen, total: null, added, duplicates });
        prog({ phase: "saving", done: seen, total: seen, added, duplicates });
        await flush();
      } catch (e) {
        if (isAbort(e) || signal.aborted) {
          await flush().catch(() => {});
          await this.finishPlayer(base, existing, maxTs ? { lastGameTs: maxTs } : {});
          throw abortError();
        }
        throw e;
      }
      const out = await this.finishPlayer(base, existing, maxTs ? { lastGameTs: maxTs } : {});
      prog({ phase: "done", done: seen, total: seen, added, duplicates });
      return { added, total: out.gameCount, playerId };
    } catch (e) {
      throw friendly(e, kind);
    } finally {
      if (this.abort === ac) this.abort = null;
    }
  }

  private async finishPlayer(
    base: Pick<Player, "id" | "source" | "username" | "displayName">,
    existing: Player | null,
    extra: Partial<Player>,
  ): Promise<Player> {
    const cur = existing ?? (await dbm.getPlayer(base.id)) ?? null;
    const gameCount = await dbm.countGames(base.id);
    const p: Player = {
      ...(cur ?? {}),
      ...base,
      ...extra,
      gameCount,
      lastSyncedAt: Date.now(),
    };
    await dbm.updatePlayer(base.id, p);
    this.invalidate();
    return p;
  }

  private async save(
    base: Pick<Player, "id" | "source" | "username" | "displayName">,
    games: Game[],
    extra: Partial<Player>,
    onProgress: (p: ImportProgress) => void,
    signal?: AbortSignal,
  ): Promise<ImportOutcome> {
    let added = 0;
    let duplicates = 0;
    try {
      for (let i = 0; i < games.length || i === 0; i += BATCH) {
        if (signal?.aborted) throw abortError();
        onProgress({ phase: "saving", done: i, total: games.length, added, duplicates });
        const r = await dbm.upsertGames(base.id, games.slice(i, i + BATCH));
        added += r.added;
        duplicates += r.duplicates;
        if (games.length === 0) break;
      }
    } catch (e) {
      await this.finishPlayer(base, null, {});
      throw e;
    }
    const p = await this.finishPlayer(base, null, extra);
    onProgress({ phase: "done", done: games.length, total: games.length, added, duplicates });
    return { added, total: p.gameCount, playerId: base.id };
  }
}

function isAbort(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

function friendly(e: unknown, kind: "chess.com" | "lichess"): Error {
  if (isAbort(e)) return e as Error;
  const site = kind === "chess.com" ? "Chess.com" : "Lichess";
  if (e instanceof HttpError) {
    if (e.status === 404) return new Error(`Player not found on ${site}`);
    if (e.status === 429) return new Error(`${site} is rate limiting requests. Please wait a minute and try again.`);
    if (e.status >= 500) return new Error(`${site} is having problems (${e.status}). Try again later.`);
    return new Error(`${site} request failed (${e.status})`);
  }
  if (e instanceof TypeError) return new Error(`Network error while contacting ${site}. Check your connection.`);
  return e instanceof Error ? e : new Error(String(e));
}
