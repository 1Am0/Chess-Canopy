import { Chess } from "chess.js";
import { filterGames } from "./engine/filter";
import { GameIndex, sanKey, type IndexNode } from "./engine/position-index";
import { classifyResult, emptyStats } from "./engine/trie";
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
import { isoDaysAgo } from "./format";
import { fetchChessComGames, parseChessComGame } from "./importers/chesscom";
import { fetchLichessGames, isOngoing, isUnfinished, parseLichessGame, type LichessRawGame } from "./importers/lichess";
import { parsePgnText, type ParseStats } from "./importers/pgn";
import { parseStoreJson } from "./importers/normalize";
import { abortError, HttpError } from "./importers/common";
import { START_FEN } from "./importers/standard";

/** Selections kept warm. Entries are small (references + visited nodes), see position-index.ts. */
const LRU_SIZE = 6;
const BATCH = 500;

interface Computed {
  /** Games of the selection with a known result, newest first. */
  filtered: Game[];
  counts: { white: number; black: number };
  /** The color filter of this selection (null: auto-pick). */
  color: Color | null;
  /** Legal-mode tree (the selection starts at move 1); false only for a `moves_start` slice. */
  legal: boolean;
  index: Partial<Record<Color, GameIndex>>;
}

interface Selection {
  ids: string[] | "all";
  idsKey: string;
  filters: Filters;
  key: string;
}

/** Drop empty values, sort keys, and resolve a rolling date preset to a concrete `date_from`. */
function normalizeFilters(f: Filters, now = Date.now()): Filters {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(f).sort()) {
    const v = (f as Record<string, unknown>)[k];
    if (v === null || v === undefined || v === "") continue;
    out[k] = v;
  }
  const preset = out.date_preset;
  delete out.date_preset;
  if (typeof preset === "number" && Number.isFinite(preset) && preset > 0) out.date_from = isoDaysAgo(preset, now);
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];
  return sorted as Filters;
}

function newestFirst(games: Game[]): Game[] {
  // Stable: ties keep the database order, exactly as the old filter-then-sort did.
  return games.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function compute(games: Game[], nf: Filters): Computed {
  // One pass without the color filter feeds both the per-side counts and the selection.
  const base = filterGames(games, { ...nf, color: null }).filter(
    (g) => (g.color === "white" || g.color === "black") && classifyResult(g.result ?? "*") !== null,
  );
  const counts = { white: 0, black: 0 };
  for (const g of base) counts[g.color]++;
  const color = nf.color ?? null;
  const filtered = color ? base.filter((g) => g.color === color) : base;
  const legal = nf.moves_start == null || nf.moves_start === 0;
  return { filtered, counts, color, legal, index: {} };
}

/**
 * The chess.js board the service walks the tree with. It follows the queried path
 * incrementally (undo back to the common prefix, then play the rest) instead of replaying
 * the whole line for every query.
 */
class PathBoard {
  readonly chess = new Chess();
  private input: string[] = [];
  private canon: string[] = [];

  /** Position the board after the first `depth` moves of `path`; throws on an illegal move. */
  seek(path: readonly string[], depth: number): Chess {
    const max = Math.min(this.input.length, depth);
    let k = 0;
    while (k < max && this.input[k] === path[k]) k++;
    while (this.input.length > k) {
      this.chess.undo();
      this.input.pop();
      this.canon.pop();
    }
    for (let i = k; i < depth; i++) {
      let san: string;
      try {
        san = this.chess.move(path[i]).san;
      } catch {
        throw new Error(`Invalid move sequence: ${path[i]}`);
      }
      this.input.push(path[i]);
      this.canon.push(san);
    }
    return this.chess;
  }

  /** Number of leading moves of `path` that are on the board already. */
  shared(path: readonly string[]): number {
    const max = Math.min(this.input.length, path.length);
    let k = 0;
    while (k < max && this.input[k] === path[k]) k++;
    return k;
  }

  /** chess.js SAN of the d-th move on the board. */
  sanAt(d: number): string {
    return this.canon[d];
  }
}

export interface ExplorerServiceOptions {
  fetchImpl?: typeof fetch;
}

export class ExplorerService implements ExplorerAPI {
  fetchImpl?: typeof fetch;
  private lru = new Map<string, Computed>();
  /** In-flight selection builds, so overlapping setSelection/query calls share one build. */
  private inflight = new Map<string, Promise<Computed>>();
  /** The loaded games of the current player set (one DB read per set, shared by every caller). */
  private games: { key: string; promise: Promise<Game[]> } | null = null;
  private opponentNames: { key: string; names: string[] } | null = null;
  /** Bumped by invalidate(); builds started before it are not cached. */
  private gen = 0;
  private sel: Selection | null = null;
  private board = new PathBoard();
  private aborts = new Set<AbortController>();
  private maintenance: Promise<unknown> | null = null;

  constructor(opts: ExplorerServiceOptions = {}) {
    this.fetchImpl = opts.fetchImpl;
  }

  /** Drops cached games and trees; the next setSelection/query rebuilds them from IndexedDB. */
  async invalidate(): Promise<void> {
    this.invalidateCaches();
  }

  private invalidateCaches() {
    this.gen++;
    this.lru.clear();
    this.inflight.clear();
    this.games = null;
    this.opponentNames = null;
  }

  /** One-time startup cleanup of games left without a player row by older versions. */
  private maintain(): Promise<unknown> {
    this.maintenance ??= dbm.deleteOrphanGames().catch(() => 0);
    return this.maintenance;
  }

  // ---- players ----
  async listPlayers(): Promise<Player[]> {
    await this.maintain();
    return dbm.listPlayers();
  }

  async deletePlayer(id: string): Promise<void> {
    await dbm.deletePlayer(id);
    this.invalidateCaches();
  }

  async exportPlayer(id: string): Promise<string> {
    const games = await dbm.getGamesForPlayers([id]);
    // Compact: half the size of pretty-printed JSON for big accounts. Each game keeps its
    // source + playerId, so re-importing the file lands in the same player.
    return JSON.stringify({ version: 1, games });
  }

  // ---- selection / query ----
  private loadGames(sel: Selection): Promise<Game[]> {
    if (this.games?.key === sel.idsKey) return this.games.promise;
    const promise = (async () => {
      await this.maintain();
      return newestFirst(await dbm.getGamesForPlayers(sel.ids));
    })();
    const entry = { key: sel.idsKey, promise };
    this.games = entry;
    promise.catch(() => {
      if (this.games === entry) this.games = null;
    });
    return promise;
  }

  private computed(sel: Selection): Promise<Computed> {
    const hit = this.lru.get(sel.key);
    if (hit) {
      this.lru.delete(sel.key);
      this.lru.set(sel.key, hit);
      return Promise.resolve(hit);
    }
    const pending = this.inflight.get(sel.key);
    if (pending) return pending;
    const gen = this.gen;
    const p = (async () => {
      const c = compute(await this.loadGames(sel), sel.filters);
      if (gen === this.gen) {
        this.lru.set(sel.key, c);
        while (this.lru.size > LRU_SIZE) this.lru.delete(this.lru.keys().next().value as string);
      }
      return c;
    })();
    this.inflight.set(sel.key, p);
    const done = () => {
      if (this.inflight.get(sel.key) === p) this.inflight.delete(sel.key);
    };
    p.then(done, done);
    return p;
  }

  async setSelection(playerIds: string[] | "all", filters: Filters): Promise<SelectionSummary> {
    const ids = playerIds === "all" ? "all" : [...new Set(playerIds)].sort();
    const idsKey = ids === "all" ? "all" : ids.join(",");
    const nf = normalizeFilters(filters ?? {});
    const sel: Selection = { ids, idsKey, filters: nf, key: `${idsKey}::${JSON.stringify(nf)}` };
    this.sel = sel;
    const c = await this.computed(sel);
    return { games: c.filtered.length, counts: { ...c.counts } };
  }

  private async current(): Promise<{ c: Computed; label: string }> {
    const sel = this.sel;
    if (!sel) throw new Error("No selection set");
    // Rebuilds after an invalidation (e.g. an import finished), sharing any in-flight build.
    const c = await this.computed(sel);
    return { c, label: sel.idsKey };
  }

  private chooseColor(c: Computed): Color {
    if (c.color) return c.color;
    let chosen: Color = c.counts.white >= c.counts.black ? "white" : "black";
    if (c.counts[chosen] === 0) chosen = chosen === "white" ? "black" : "white";
    return chosen;
  }

  private indexFor(c: Computed, color: Color): GameIndex {
    let idx = c.index[color];
    if (!idx) {
      idx = new GameIndex(
        c.filtered.filter((g) => g.color === color),
        c.legal,
      );
      c.index[color] = idx;
    }
    return idx;
  }

  /**
   * The tree node for `path` (validated with chess.js; throws "Invalid move sequence").
   * Walks forward once: nodes built earlier are followed by the moves already on the board,
   * and each new node is built while the board steps through the path, seeded with the
   * path move's SAN, so a cold 200-ply line costs about one chess.js move per ply.
   */
  private locate(c: Computed, color: Color, path: string[]) {
    const index = this.indexFor(c, color);
    const board = this.board;
    const boardAt = (d: number) => board.seek(path, d);
    if (!c.legal) {
      board.seek(path, path.length);
      return { index, boardAt, node: index.nodeAt(path, boardAt) };
    }
    const shared = board.shared(path);
    let node: IndexNode | null = index.root;
    let d = 0;
    while (node && d < shared && node.children) {
      node = node.children.get(board.sanAt(d)) ?? null;
      if (node) d++;
    }
    if (node) {
      while (node && d < path.length) {
        const fresh = !node.children;
        // Only play forward; the board is moved back just for nodes that need it (boardAt).
        if (board.shared(path) < d + 1) board.seek(path, d + 1);
        const san = board.sanAt(d);
        const kids: Map<string, IndexNode> = fresh ? index.children(node, d, boardAt, new Map([[sanKey(san), san]])) : node.children!;
        node = kids.get(san) ?? null;
        d++;
      }
    }
    board.seek(path, path.length); // validates the rest of the path, reached or not
    return { index, boardAt, node };
  }

  async query(path: string[]): Promise<QueryResult> {
    const { c, label } = await this.current();
    if (c.filtered.length === 0) {
      let fen = START_FEN;
      try {
        fen = this.board.seek(path, path.length).fen();
      } catch {
        /* not playable: the start position */
      }
      return { player: label, games: 0, path, fen, stats: emptyStats(), next: [] };
    }
    const color = this.chooseColor(c);
    const { index, boardAt, node } = this.locate(c, color, path);
    const stats = node ? GameIndex.stats(node) : emptyStats();
    const next = node ? index.next(node, path.length, boardAt) : [];
    const fen = this.board.seek(path, path.length).fen();
    return { player: label, color, games: c.filtered.length, path, fen, stats, next };
  }

  async gamesAt(path: string[], limit: number, offset = 0): Promise<GameSummary[]> {
    const { c } = await this.current();
    if (c.filtered.length === 0) return [];
    const color = this.chooseColor(c);
    let found: ReturnType<ExplorerService["locate"]>;
    try {
      found = this.locate(c, color, path);
    } catch {
      return [];
    }
    const { index, node } = found;
    if (!node) return [];
    const out: GameSummary[] = [];
    const from = Math.max(0, Math.floor(offset) || 0);
    const n = Math.min(from + Math.max(0, Math.floor(limit) || 0), node.idx.length);
    for (let k = from; k < n; k++) {
      const g = index.games[node.idx[k]];
      out.push({
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
        moves: g.moves,
      });
    }
    return out;
  }

  async opponents(): Promise<string[]> {
    const sel = this.sel;
    if (!sel) return [];
    if (this.opponentNames?.key === sel.idsKey) return this.opponentNames.names;
    const gen = this.gen;
    const games = await this.loadGames(sel);
    const freq = new Map<string, { name: string; n: number }>();
    for (const g of games) {
      if (!g.opponent) continue;
      const k = g.opponent.toLowerCase();
      const e = freq.get(k);
      if (e) e.n++;
      else freq.set(k, { name: g.opponent, n: 1 });
    }
    const names = [...freq.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map((e) => e.name);
    if (gen === this.gen) this.opponentNames = { key: sel.idsKey, names };
    return names;
  }

  // ---- import ----
  async cancelImport(): Promise<void> {
    for (const ac of this.aborts) ac.abort();
  }

  /** Runs `fn` with its own abort controller, so concurrent imports can all be cancelled. */
  private async tracked<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const ac = new AbortController();
    this.aborts.add(ac);
    try {
      return await fn(ac.signal);
    } finally {
      this.aborts.delete(ac);
    }
  }

  importGames(req: ImportRequest, onProgress: (p: ImportProgress) => void): Promise<ImportOutcome> {
    return this.tracked(async (signal) => {
      const username = req.username.trim();
      if (!username) throw new Error("Enter a username");
      if (req.kind !== "pgn" && req.kind !== "json") return this.runRemote(req.kind, username, null, onProgress, signal);
      const source: Source = req.kind === "json" ? (req.source ?? "json") : "pgn";
      const labelId = `${source}:${username.toLowerCase()}`;
      onProgress({ phase: "parsing", done: 0, total: null, added: 0, duplicates: 0 });
      const stats: ParseStats = { skipped: 0 };
      let games: Game[];
      try {
        const text = req.text ?? (req.file ? await req.file.text() : "");
        games =
          req.kind === "pgn"
            ? parsePgnText(text, username, stats).map((g) => ({ ...g, source, playerId: labelId }))
            : parseStoreJson(text, { source, playerId: labelId }, stats);
      } catch (e) {
        throw new Error(`Could not read file: ${e instanceof Error ? e.message : String(e)}`);
      }
      // Games without a result yet (`*`) never appear in the explorer, so they are not stored.
      const finished = games.filter((g) => classifyResult(g.result ?? "*") !== null);
      const unfinished = games.length - finished.length;
      games = finished;
      if (games.length === 0 && unfinished > 0) {
        throw new Error(`No finished games found in the file (${unfinished.toLocaleString()} without a result skipped)`);
      }
      if (games.length === 0) {
        throw new Error(
          stats.skipped
            ? `No standard games found in the file (${stats.skipped.toLocaleString()} non-standard skipped)`
            : "No games found in the file",
        );
      }
      // Games carrying their own playerId (this app's export) go back to that player.
      const groups = new Map<string, Game[]>();
      for (const g of games) {
        const list = groups.get(g.playerId);
        if (list) list.push(g);
        else groups.set(g.playerId, [g]);
      }
      const targets: Array<{ base: dbm.PlayerBase; games: Game[] }> = [];
      for (const [id, list] of groups) {
        const src = list[0].source;
        if (id === labelId) {
          targets.push({ base: { id, source: src, username: username.toLowerCase(), displayName: username }, games: list });
        } else {
          const user = id.slice(src.length + 1);
          const cur = await dbm.getPlayer(id);
          targets.push({ base: { id, source: src, username: user, displayName: cur?.displayName || user }, games: list });
        }
      }
      return this.saveAll(targets, onProgress, signal, stats.skipped, unfinished);
    });
  }

  syncPlayer(id: string, onProgress: (p: ImportProgress) => void): Promise<ImportOutcome> {
    return this.tracked(async (signal) => {
      const p = await dbm.getPlayer(id);
      if (!p) throw new Error("Player not found");
      if (p.source !== "chess.com" && p.source !== "lichess") {
        throw new Error("Only Chess.com and Lichess players can be synced");
      }
      return this.runRemote(p.source, p.displayName || p.username, p, onProgress, signal);
    });
  }

  private async runRemote(
    kind: "chess.com" | "lichess",
    username: string,
    existing: Player | null,
    onProgress: (p: ImportProgress) => void,
    signal: AbortSignal,
  ): Promise<ImportOutcome> {
    const playerId = `${kind}:${username.toLowerCase()}`;
    const base: dbm.PlayerBase = { id: playerId, source: kind, username: username.toLowerCase(), displayName: username };
    const prog = (p: Partial<ImportProgress> & Pick<ImportProgress, "phase">) =>
      onProgress({ done: 0, total: null, added: 0, duplicates: 0, ...p });
    try {
      if (kind === "chess.com") return await this.runChessCom(base, existing, prog, signal);
      return await this.runLichess(base, existing, prog, signal);
    } catch (e) {
      throw friendly(e, kind);
    }
  }

  /**
   * Chess.com: fetch the monthly archives oldest first and save each month as it arrives.
   * `lastSyncedMonth` only ever covers the contiguous run of saved months, so after a
   * cancel or a failed month the games already downloaded are kept and the next Sync
   * resumes from the failed month. A failure after some games were saved is reported as a
   * partial outcome (`partial`), a cancel throws an AbortError after the watermark is stored.
   */
  private async runChessCom(
    base: dbm.PlayerBase,
    existing: Player | null,
    prog: (p: Partial<ImportProgress> & Pick<ImportProgress, "phase">) => void,
    signal: AbortSignal,
  ): Promise<ImportOutcome> {
    const username = base.displayName;
    let added = 0;
    let duplicates = 0;
    let skipped = 0;
    let months = 0;
    let savedAny = false;
    let committed = existing?.lastSyncedMonth;
    let progressMonths = { done: 0, total: 0 };
    try {
      await fetchChessComGames(username, {
        sinceMonth: existing?.lastSyncedMonth ?? null,
        signal,
        fetchImpl: this.fetchImpl,
        onProgress: (p) => {
          progressMonths = { done: p.done, total: p.total };
          prog({ phase: "fetching", done: p.done, total: p.total, added, duplicates });
        },
        onMonth: async (month, raws) => {
          const games: Game[] = [];
          for (const raw of raws) {
            const g = parseChessComGame(raw, username);
            if (g) games.push({ ...g, playerId: base.id, source: "chess.com" });
            else skipped++;
          }
          if (games.length) {
            const r = await dbm.saveGames(base, games);
            added += r.added;
            duplicates += r.duplicates;
            savedAny = true;
          }
          committed = month;
          months++;
          prog({ phase: "fetching", done: progressMonths.done, total: progressMonths.total, added, duplicates });
        },
      });
    } catch (e) {
      const aborted = isAbort(e) || signal.aborted;
      if (savedAny || existing) {
        await this.finishPlayer(base, existing, committed ? { lastSyncedMonth: committed } : {}).catch(() => null);
      }
      if (aborted) throw abortError();
      if (!savedAny) throw e;
      const reason = friendly(e, "chess.com").message;
      const out = await dbm.countGames(base.id);
      const message = `Imported ${added.toLocaleString()} new games; the rest failed (${reason}). Run Sync to retry.`;
      prog({ phase: "done", done: months, total: progressMonths.total, added, duplicates, skipped, message });
      return { added, total: out, playerId: base.id, playerIds: [base.id], skipped, partial: message };
    }
    prog({ phase: "saving", done: months, total: months, added, duplicates });
    const out = await this.finishPlayer(base, existing, committed ? { lastSyncedMonth: committed } : {});
    prog({ phase: "done", done: months, total: months, added, duplicates, skipped, message: skippedMessage(skipped) });
    return { added, total: out.gameCount, playerId: base.id, playerIds: [base.id], skipped };
  }

  /**
   * Lichess: stream oldest first (sort=dateAsc, ongoing=true) and save in batches, so a cancel
   * or a network error keeps what was saved. The watermark `lastGameTs` only covers games
   * that are durably stored (or deliberately skipped) and never passes an ongoing game, so a
   * later Sync fetches everything that is missing.
   */
  private async runLichess(
    base: dbm.PlayerBase,
    existing: Player | null,
    prog: (p: Partial<ImportProgress> & Pick<ImportProgress, "phase">) => void,
    signal: AbortSignal,
  ): Promise<ImportOutcome> {
    const prevMark = existing?.lastGameTs ?? 0;
    let added = 0;
    let duplicates = 0;
    let seen = 0;
    let skipped = 0;
    let savedAny = false;
    /** Watermark safe to persist right now. */
    let committed = prevMark;
    /** Newest createdAt streamed so far. */
    let maxTs = prevMark;
    /** Stays true while createdAt never decreases (the stream is really oldest first). */
    let ascending = true;
    let lastTs = -Infinity;
    /** createdAt - 1 of the oldest ongoing game: the watermark must stay before it. */
    let ongoingCap = Infinity;
    let buf: Game[] = [];

    const flush = async () => {
      // With an oldest-first stream, everything up to the newest streamed game is either in
      // `buf` or already handled, so once `buf` is stored the watermark may move up to it.
      const upTo = ascending ? Math.min(maxTs, ongoingCap) : null;
      if (buf.length) {
        const r = await dbm.saveGames(base, buf);
        added += r.added;
        duplicates += r.duplicates;
        savedAny = true;
        buf = [];
      }
      if (upTo !== null && upTo > committed) committed = upTo;
    };
    const finish = () => this.finishPlayer(base, existing, committed > 0 ? { lastGameTs: committed } : {});

    try {
      for await (const raw of fetchLichessGames(base.displayName, {
        since: existing?.lastGameTs != null ? existing.lastGameTs + 1 : null,
        signal,
        fetchImpl: this.fetchImpl,
      })) {
        seen++;
        const r = raw as LichessRawGame;
        const ts = typeof r.createdAt === "number" && Number.isFinite(r.createdAt) ? r.createdAt : null;
        if (ts !== null) {
          if (ts < lastTs) ascending = false;
          lastTs = Math.max(lastTs, ts);
          maxTs = Math.max(maxTs, ts);
        }
        if (isOngoing(r)) {
          if (ts !== null) ongoingCap = Math.min(ongoingCap, ts - 1);
        } else if (!isUnfinished(r)) {
          const g = parseLichessGame(r, base.displayName);
          if (g) buf.push({ ...g, playerId: base.id, source: "lichess" });
          else skipped++;
        }
        if (seen % 25 === 0) prog({ phase: "fetching", done: seen, total: null, added, duplicates });
        if (buf.length >= BATCH) await flush();
      }
      prog({ phase: "saving", done: seen, total: seen, added, duplicates });
      await flush();
      // The stream completed, so every game up to the newest one was seen (in any order).
      const complete = Math.min(maxTs, ongoingCap);
      if (complete > committed) committed = complete;
    } catch (e) {
      try {
        await flush();
      } catch {
        /* the watermark stays at the last batch that was stored */
      }
      if (savedAny || existing) await finish();
      if (isAbort(e) || signal.aborted) throw abortError();
      throw e;
    }
    const out = await finish();
    prog({ phase: "done", done: seen, total: seen, added, duplicates, skipped, message: skippedMessage(skipped) });
    return { added, total: out.gameCount, playerId: base.id, playerIds: [base.id], skipped };
  }

  private async finishPlayer(base: dbm.PlayerBase, existing: Player | null, extra: Partial<Player>): Promise<Player> {
    const cur = (await dbm.getPlayer(base.id)) ?? existing ?? null;
    const gameCount = await dbm.countGames(base.id);
    const p: Player = {
      ...(cur ?? {}),
      ...base,
      ...extra,
      gameCount,
      lastSyncedAt: Date.now(),
    };
    await dbm.updatePlayer(base.id, p);
    this.invalidateCaches();
    return p;
  }

  /** Save each player's games in batches (the player row is written with every batch). */
  private async saveAll(
    targets: Array<{ base: dbm.PlayerBase; games: Game[]; extra?: Partial<Player>; existing?: Player | null }>,
    onProgress: (p: ImportProgress) => void,
    signal: AbortSignal,
    skipped: number,
    unfinished = 0,
  ): Promise<ImportOutcome> {
    const total = targets.reduce((n, t) => n + t.games.length, 0);
    let added = 0;
    let duplicates = 0;
    let done = 0;
    const totals: Array<{ id: string; count: number; games: number }> = [];
    for (const t of targets) {
      let saved = false;
      try {
        for (let i = 0; i < t.games.length || i === 0; i += BATCH) {
          if (signal.aborted) throw abortError();
          onProgress({ phase: "saving", done, total, added, duplicates });
          const batch = t.games.slice(i, i + BATCH);
          const r = await dbm.saveGames(t.base, batch);
          saved = true;
          added += r.added;
          duplicates += r.duplicates;
          done += batch.length;
          if (t.games.length === 0) break;
        }
      } catch (e) {
        if (saved || t.existing) await this.finishPlayer(t.base, t.existing ?? null, {});
        throw e;
      }
      const p = await this.finishPlayer(t.base, t.existing ?? null, t.extra ?? {});
      totals.push({ id: t.base.id, count: p.gameCount, games: t.games.length });
    }
    onProgress({ phase: "done", done: total, total, added, duplicates, skipped, unfinished, message: skippedMessage(skipped, unfinished) });
    const main = totals.reduce((a, b) => (b.games > a.games ? b : a), totals[0]);
    return {
      added,
      total: totals.reduce((n, t) => n + t.count, 0),
      playerId: main.id,
      playerIds: totals.map((t) => t.id),
      skipped,
      ...(unfinished ? { unfinished } : {}),
    };
  }
}

function skippedMessage(skipped: number, unfinished = 0): string | undefined {
  const parts: string[] = [];
  if (skipped) parts.push(`${skipped.toLocaleString()} non-standard game${skipped === 1 ? "" : "s"} (variants or custom start positions)`);
  if (unfinished) parts.push(`${unfinished.toLocaleString()} game${unfinished === 1 ? "" : "s"} without a result`);
  return parts.length ? `Skipped ${parts.join(" and ")}` : undefined;
}

function isAbort(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

function friendly(e: unknown, kind: "chess.com" | "lichess"): Error {
  if (isAbort(e)) return e as Error;
  const site = kind === "chess.com" ? "Chess.com" : "Lichess";
  if (e instanceof HttpError) {
    const why = e.body ? `: ${e.body}` : "";
    if (e.status === 404) return new Error(`Player not found on ${site}`);
    if (e.status === 429) return new Error(`${site} is rate limiting requests${why}. Please wait a minute and try again.`);
    if (e.status === 403) return new Error(`${site} refused the request (403)${why}. Please wait a while and try again.`);
    if (e.status >= 500) return new Error(`${site} is having problems (${e.status}). Try again later.`);
    return new Error(`${site} request failed (${e.status})${why}`);
  }
  if (e instanceof TypeError) return new Error(`Network error while contacting ${site}. Check your connection.`);
  return e instanceof Error ? e : new Error(String(e));
}
