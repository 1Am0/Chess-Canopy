import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ExplorerService } from "@/lib/explorer-service";
import { db } from "@/lib/db";
import type { Filters, ImportProgress } from "@/lib/engine/types";

const rd = (p: string) => readFileSync(`tests/fixtures/${p}`, "utf8");
const sampleJson = rd("golden/sample_games.json");
const samplePgn = rd("golden/sample.pgn");
const golden = JSON.parse(rd("golden/explorer_golden.json")) as {
  cases: Array<{ filters: Filters; color: "white" | "black"; path: string[]; filtered_count: number; stats: unknown; next: unknown[] }>;
};
const chesscom = JSON.parse(rd("api/chesscom_game.json"));
const lichessLine = JSON.stringify(JSON.parse(rd("api/lichess_game.json")));

const noop = () => {};
const jsonReq = { kind: "json" as const, username: "hero", text: sampleJson };

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function chesscomFetch(months: string[]) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith("/games/archives")) {
      return jsonRes({ archives: months.map((m) => `https://api.chess.com/pub/player/hero/games/${m}`) });
    }
    return jsonRes({ games: [chesscom] });
  });
}

let svc: ExplorerService;
beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  svc = new ExplorerService();
});

describe("json/pgn import", () => {
  it("imports JSON, records player, dedupes on repeat", async () => {
    const progress: ImportProgress[] = [];
    const out = await svc.importGames(jsonReq, (p) => progress.push(p));
    expect(out).toEqual({ added: 3, total: 3, playerId: "json:hero", playerIds: ["json:hero"], skipped: 0 });
    expect(progress.at(-1)?.phase).toBe("done");
    const again = await svc.importGames(jsonReq, noop);
    expect(again.added).toBe(0);
    expect(again.total).toBe(3);
    const players = await svc.listPlayers();
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ id: "json:hero", source: "json", gameCount: 3 });
  });

  it("imports PGN", async () => {
    const out = await svc.importGames({ kind: "pgn", username: "Hero", text: samplePgn }, noop);
    expect(out.playerId).toBe("pgn:hero");
    expect(out.added).toBeGreaterThan(0);
    const sel = await svc.setSelection(["pgn:hero"], {});
    expect(sel.games).toBe(out.total);
  });

  it("export round-trips", async () => {
    await svc.importGames(jsonReq, noop);
    const exp = JSON.parse(await svc.exportPlayer("json:hero"));
    expect(exp.version).toBe(1);
    expect(exp.games).toHaveLength(3);
  });
});

describe("selection/query vs python goldens", () => {
  it("matches stats and next for every golden case", async () => {
    await svc.importGames(jsonReq, noop);
    let checked = 0;
    for (const c of golden.cases) {
      // golden "other color" cases under a color filter use a trie our selection never exposes
      if (c.filters.color && c.filters.color !== c.color) continue;
      const filters = { ...c.filters, ...(c.filters.color ? {} : { color: c.color }) };
      const sel = await svc.setSelection(["json:hero"], filters);
      if (c.filters.color) expect(sel.games).toBe(c.filtered_count);
      const r = await svc.query(c.path);
      expect(r.stats, JSON.stringify(c)).toEqual(c.stats);
      expect(r.next, JSON.stringify(c)).toEqual(c.next);
      checked++;
    }
    expect(checked).toBeGreaterThan(80);
  });

  it("filtered counts match without color", async () => {
    await svc.importGames(jsonReq, noop);
    for (const c of golden.cases) {
      if (c.color !== "white") continue;
      const sel = await svc.setSelection("all", c.filters);
      expect(sel.games).toBe(c.filtered_count);
    }
  });

  it("auto-picks color and flips when chosen has none", async () => {
    await svc.importGames(jsonReq, noop);
    await svc.setSelection(["json:hero"], {});
    expect((await svc.query([])).color).toBe("white");
    await svc.setSelection(["json:hero"], { opponent: "opponent_c" });
    const r = await svc.query([]);
    expect(r.color).toBe("black");
    expect(r.games).toBe(1);
  });

  it("returns fen, throws on illegal path, empty set ok", async () => {
    await svc.importGames(jsonReq, noop);
    await svc.setSelection(["json:hero"], {});
    const r = await svc.query(["e4", "e5"]);
    expect(r.fen).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
    await expect(svc.query(["e5"])).rejects.toThrow(/Invalid move/);
    await svc.setSelection(["json:hero"], { opponent: "nobody" });
    const e = await svc.query([]);
    expect(e.games).toBe(0);
    expect(e.next).toEqual([]);
  });

  it("gamesAt returns newest first, respects color and limit", async () => {
    await svc.importGames(jsonReq, noop);
    await svc.setSelection(["json:hero"], {});
    const g = await svc.gamesAt([], 10);
    expect(g.map((x) => x.game_id)).toEqual(["sample-2", "sample-1"]);
    expect((await svc.gamesAt(["e4"], 10)).map((x) => x.game_id)).toEqual(["sample-1"]);
    // Each summary carries the full move list so the UI can load the game into the line.
    for (const game of await svc.gamesAt([], 10)) {
      expect(game.moves.length).toBeGreaterThan(0);
    }
    expect((await svc.gamesAt(["e4"], 10))[0].moves[0]).toBe("e4");
    expect(await svc.gamesAt([], 1)).toHaveLength(1);
    await svc.setSelection(["json:hero"], { color: "black" });
    expect((await svc.gamesAt([], 10)).map((x) => x.game_id)).toEqual(["sample-3"]);
  });

  it("opponents sorted by frequency", async () => {
    await svc.importGames(jsonReq, noop);
    await svc.setSelection("all", {});
    expect(await svc.opponents()).toEqual(["opponent_a", "opponent_b", "opponent_c"]);
  });

  it("invalidates caches after import and delete", async () => {
    await svc.importGames(jsonReq, noop);
    expect((await svc.setSelection("all", {})).games).toBe(3);
    await svc.importGames({ kind: "pgn", username: "Hero", text: samplePgn }, noop);
    expect((await svc.setSelection("all", {})).games).toBeGreaterThan(3);
    await svc.deletePlayer("json:hero");
    expect(await svc.listPlayers()).toHaveLength(1);
    const sel = await svc.setSelection("all", {});
    expect(sel.games).toBe((await db.games.count()));
    expect(await db.games.where("playerId").equals("json:hero").count()).toBe(0);
  });
});

describe("chess.com", () => {
  it("imports via fetchImpl and records lastSyncedMonth", async () => {
    const f = chesscomFetch(["2024/01", "2024/02"]);
    const s = new ExplorerService({ fetchImpl: f as unknown as typeof fetch });
    const progress: ImportProgress[] = [];
    const out = await s.importGames({ kind: "chess.com", username: "Hero" }, (p) => progress.push(p));
    expect(out.playerId).toBe("chess.com:hero");
    expect(out.added).toBe(1); // same game id in both months
    expect(progress.some((p) => p.phase === "fetching" && p.total === 2)).toBe(true);
    expect(progress.at(-1)?.phase).toBe("done");
    const [p] = await s.listPlayers();
    expect(p).toMatchObject({ displayName: "Hero", lastSyncedMonth: "2024/02", gameCount: 1 });
  });

  it("incremental sync passes sinceMonth", async () => {
    const f = chesscomFetch(["2024/01", "2024/02", "2024/03"]);
    const s = new ExplorerService({ fetchImpl: f as unknown as typeof fetch });
    await s.importGames({ kind: "chess.com", username: "hero" }, noop);
    f.mockClear();
    const out = await s.syncPlayer("chess.com:hero", noop);
    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes("/games/2024/"))).toEqual([
      "https://api.chess.com/pub/player/hero/games/2024/03",
    ]);
    expect(out.added).toBe(0);
  });

  it("404 gives friendly message", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 404 }));
    const s = new ExplorerService({ fetchImpl: f as unknown as typeof fetch });
    await expect(s.importGames({ kind: "chess.com", username: "ghost" }, noop)).rejects.toThrow("Player not found on Chess.com");
  });

  it("cancel aborts with AbortError", async () => {
    const f = vi.fn(async (_u: unknown, init?: RequestInit) => {
      await new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("x"), { name: "AbortError" }))));
      return jsonRes({});
    });
    const s = new ExplorerService({ fetchImpl: f as unknown as typeof fetch });
    const p = s.importGames({ kind: "chess.com", username: "hero" }, noop);
    await new Promise((r) => setTimeout(r, 20));
    await s.cancelImport();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("lichess", () => {
  it("imports NDJSON and tracks lastGameTs; sync passes since", async () => {
    const f = vi.fn(async (...args: [string]) => { void args; return new Response(lichessLine + "\n", { status: 200 }); });
    const s = new ExplorerService({ fetchImpl: f as unknown as typeof fetch });
    const out = await s.importGames({ kind: "lichess", username: "Hero" }, noop);
    expect(out).toMatchObject({ added: 1, playerId: "lichess:hero" });
    const [p] = await s.listPlayers();
    expect(p.lastGameTs).toBe(1709640000000);
    expect(String(f.mock.calls[0][0])).not.toContain("since=");
    await s.syncPlayer("lichess:hero", noop);
    expect(String(f.mock.calls[1][0])).toContain("since=1709640000001");
    expect((await s.listPlayers())[0].gameCount).toBe(1);
  });

  it("404 gives friendly message", async () => {
    const f = vi.fn(async () => new Response("", { status: 404 }));
    const s = new ExplorerService({ fetchImpl: f as unknown as typeof fetch });
    await expect(s.importGames({ kind: "lichess", username: "ghost" }, noop)).rejects.toThrow("Player not found on Lichess");
  });

  it("cancel keeps saved games and throws AbortError", async () => {
    const enc = new TextEncoder();
    const f = vi.fn(async (_u: unknown, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(enc.encode(lichessLine + "\n"));
          init?.signal?.addEventListener("abort", () => c.error(Object.assign(new Error("a"), { name: "AbortError" })));
        },
      });
      return new Response(body, { status: 200 });
    });
    const s = new ExplorerService({ fetchImpl: f as unknown as typeof fetch });
    const p = s.importGames({ kind: "lichess", username: "hero" }, noop);
    await new Promise((r) => setTimeout(r, 30));
    await s.cancelImport();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(await db.games.where("playerId").equals("lichess:hero").count()).toBe(1);
  });
});

const T0 = 1_700_000_000_000;
const enc = new TextEncoder();
type LiGame = { i: number; status?: string; variant?: string; moves?: string };
const liLine = (g: LiGame) =>
  JSON.stringify({
    id: `g${g.i}`,
    variant: g.variant ?? "standard",
    speed: "blitz",
    status: g.status ?? "resign",
    createdAt: T0 + g.i * 60_000,
    moves: g.moves ?? "e4 e5",
    winner: g.status === "started" ? undefined : "white",
    players: { white: { user: { name: "hero" }, rating: 1500 }, black: { user: { name: "opp" }, rating: 1500 } },
    clock: { initial: 180, increment: 0 },
  });

/**
 * A fake Lichess export: honors since, sort and ongoing like the real endpoint.
 * `failAt` errors the stream (network) and `cancelAt` cancels via the service after that many lines.
 */
function lichessServer(all: LiGame[], o: { failAt?: number; cancelAt?: number; svc?: () => ExplorerService } = {}) {
  const urls: string[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    urls.push(url);
    const q = new URL(url).searchParams;
    const since = Number(q.get("since") ?? 0);
    let items = all.filter((g) => T0 + g.i * 60_000 >= since);
    if (q.get("ongoing") !== "true") items = items.filter((g) => g.status !== "started");
    items.sort((a, b) => (q.get("sort") === "dateAsc" ? a.i - b.i : b.i - a.i));
    let k = 0;
    const failAt = o.failAt;
    const cancelAt = o.cancelAt;
    o.failAt = undefined; // only the first request misbehaves
    o.cancelAt = undefined;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (init?.signal?.aborted) return c.error(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (k === failAt) return c.error(new TypeError("Failed to fetch"));
        if (k >= items.length) return c.close();
        c.enqueue(enc.encode(liLine(items[k++]) + "\n"));
        if (k === cancelAt) setTimeout(() => void o.svc?.().cancelImport(), 0);
        return new Promise((r) => setTimeout(r, 0));
      },
    });
    return new Response(body, { status: 200 });
  });
  return { f: f as unknown as typeof fetch, urls };
}

const range = (n: number, extra: Partial<LiGame> = {}) => Array.from({ length: n }, (_, i) => ({ i, ...extra }));

describe("lichess watermark", () => {
  it("requests oldest first with ongoing games", async () => {
    const srv = lichessServer(range(3));
    const s = new ExplorerService({ fetchImpl: srv.f });
    await s.importGames({ kind: "lichess", username: "hero" }, noop);
    const q = new URL(srv.urls[0]).searchParams;
    expect(q.get("sort")).toBe("dateAsc");
    expect(q.get("ongoing")).toBe("true");
  });

  it("cancel, then Sync fetches the rest", async () => {
    const srv = lichessServer(range(1200), { cancelAt: 700, svc: () => s });
    const s = new ExplorerService({ fetchImpl: srv.f });
    await expect(s.importGames({ kind: "lichess", username: "hero" }, noop)).rejects.toMatchObject({ name: "AbortError" });
    const saved = await db.games.count();
    expect(saved).toBeGreaterThanOrEqual(500);
    expect(saved).toBeLessThan(1200);
    const p = (await db.players.get("lichess:hero"))!;
    // the watermark covers exactly what was stored
    expect(p.lastGameTs).toBe(T0 + (saved - 1) * 60_000);
    const r = await s.syncPlayer("lichess:hero", noop);
    expect(r.total).toBe(1200);
    expect(r.added).toBe(1200 - saved);
  });

  it("a newest-first stream that is cut off never moves the watermark", async () => {
    // A server that ignores sort=dateAsc: an interrupted stream must not skip older games.
    const all = range(800);
    const f = vi.fn(async (url: string) => {
      const since = Number(new URL(url).searchParams.get("since") ?? 0);
      const items = all.filter((g) => T0 + g.i * 60_000 >= since).sort((a, b) => b.i - a.i);
      let k = 0;
      const failAt = f.mock.calls.length === 1 ? 600 : -1;
      return new Response(
        new ReadableStream<Uint8Array>({
          pull(c) {
            if (k === failAt) return c.error(new TypeError("Failed to fetch"));
            if (k >= items.length) return c.close();
            c.enqueue(enc.encode(liLine(items[k++]) + "\n"));
          },
        }),
      );
    });
    const s = new ExplorerService({ fetchImpl: f as unknown as typeof fetch });
    await expect(s.importGames({ kind: "lichess", username: "hero" }, noop)).rejects.toThrow(/Network error/);
    expect((await db.players.get("lichess:hero"))?.lastGameTs).toBeUndefined();
    const r = await s.syncPlayer("lichess:hero", noop);
    expect(r.total).toBe(800);
  });

  it("an ongoing game is not stored and freezes the watermark before it", async () => {
    const all: LiGame[] = [...range(5), { i: 5, status: "started" }, ...range(4).map((g) => ({ i: g.i + 6 }))];
    const srv = lichessServer(all);
    const s = new ExplorerService({ fetchImpl: srv.f });
    const out = await s.importGames({ kind: "lichess", username: "hero" }, noop);
    expect(out.total).toBe(9);
    expect(await db.games.get("lichess:hero|g5")).toBeUndefined();
    expect((await db.players.get("lichess:hero"))!.lastGameTs).toBe(T0 + 5 * 60_000 - 1);
    // the game finishes; the next sync picks it up (the later games are deduped)
    all[5] = { i: 5 };
    const r = await s.syncPlayer("lichess:hero", noop);
    expect(srv.urls[1]).toContain(`since=${T0 + 5 * 60_000}`);
    expect(r).toMatchObject({ added: 1, total: 10 });
    expect((await db.players.get("lichess:hero"))!.lastGameTs).toBe(T0 + 9 * 60_000);
  });

  it("a network error mid-stream still writes the player row; nothing is orphaned", async () => {
    const srv = lichessServer(range(900), { failAt: 650 });
    const s = new ExplorerService({ fetchImpl: srv.f });
    await expect(s.importGames({ kind: "lichess", username: "hero" }, noop)).rejects.toThrow(/Network error/);
    const players = await s.listPlayers();
    expect(players).toHaveLength(1);
    expect(players[0].gameCount).toBe(await db.games.count());
    expect((await s.setSelection("all", {})).games).toBe(players[0].gameCount);
    const r = await s.syncPlayer("lichess:hero", noop);
    expect(r.total).toBe(900);
  });

  it("skips variant and aborted games without blocking the watermark", async () => {
    const srv = lichessServer([{ i: 0 }, { i: 1, variant: "crazyhouse" }, { i: 2, status: "aborted" }, { i: 3, moves: "e4 e5 N@f3" }]);
    const s = new ExplorerService({ fetchImpl: srv.f });
    const progress: ImportProgress[] = [];
    const out = await s.importGames({ kind: "lichess", username: "hero" }, (p) => progress.push(p));
    expect(out).toMatchObject({ added: 1, skipped: 2 });
    expect(progress.at(-1)?.message).toMatch(/Skipped 2 non-standard games/);
    expect((await db.players.get("lichess:hero"))!.lastGameTs).toBe(T0 + 3 * 60_000);
  });
});

describe("orphans and 'all'", () => {
  it("'all' ignores games without a player and startup cleanup removes them", async () => {
    await svc.importGames(jsonReq, noop);
    await db.games.bulkAdd([
      { ...JSON.parse(sampleJson).games[0], game_id: "o1", id: "ghost:x|o1", playerId: "ghost:x", source: "json" },
      { ...JSON.parse(sampleJson).games[1], game_id: "o2", id: "ghost:x|o2", playerId: "ghost:x", source: "json" },
    ]);
    const fresh = new ExplorerService();
    expect((await fresh.setSelection("all", {})).games).toBe(3);
    expect(await db.games.where("playerId").equals("ghost:x").count()).toBe(0); // cleaned on first use
    expect(await fresh.listPlayers()).toHaveLength(1);
  });

  it("cleanup with no players left removes every game", async () => {
    await svc.importGames(jsonReq, noop);
    await db.players.clear(); // as if an old version lost the row
    const fresh = new ExplorerService();
    expect(await fresh.listPlayers()).toEqual([]);
    expect(await db.games.count()).toBe(0);
  });
});

describe("selection races", () => {
  function countReads() {
    let reads = 0;
    const orig = db.games.where.bind(db.games);
    const spy = vi.spyOn(db.games, "where").mockImplementation(((...a: Parameters<typeof orig>) => {
      reads++;
      return orig(...a);
    }) as typeof db.games.where);
    return { get reads() { return reads; }, restore: () => spy.mockRestore() };
  }

  it("setSelection plus a concurrent query does one DB read and one build", async () => {
    await svc.importGames(jsonReq, noop);
    await svc.listPlayers(); // one-time orphan cleanup out of the way
    const c = countReads();
    try {
      const [sum, r] = await Promise.all([svc.setSelection(["json:hero"], { color: "white" }), svc.query(["e4"])]);
      expect(sum.games).toBe(2);
      expect(r.stats.total).toBe(1);
      expect(c.reads).toBe(1);
      // two overlapping selections of the same players share the read
      const [a, b] = await Promise.all([
        svc.setSelection(["json:hero"], { color: "black" }),
        svc.setSelection(["json:hero"], { color: "white", result: "1-0" }),
      ]);
      expect([a.games, b.games]).toEqual([1, 1]);
      expect(c.reads).toBe(1);
      await svc.opponents();
      expect(c.reads).toBe(1);
    } finally {
      c.restore();
    }
  });

  it("an import during a build does not cache stale data", async () => {
    await svc.importGames(jsonReq, noop);
    const p = svc.setSelection("all", {});
    await svc.importGames({ kind: "pgn", username: "Hero", text: samplePgn }, noop);
    await p;
    expect((await svc.setSelection("all", {})).games).toBe(await db.games.count());
  });
});

describe("query legality and canonical moves (C4c, C17, C22)", () => {
  const g = (game_id: string, moves: string[], result = "1-0") => ({
    game_id, moves, result, color: "white", date: "2024-01-01", opponent: "x", my_rating: null, opponent_rating: null,
    time_control: "blitz", time_control_raw: "", termination: "", url: "",
  });
  it("next has only legal moves, merges check-mark spellings, and walks non-canonical paths", async () => {
    // Bypass import validation (old data): stored variant / sloppy SAN games.
    await dbPut("json:hero", [
      g("a", ["e4", "e5", "Bc4", "Nc6", "Bxf7+"]),
      g("b", ["e4", "e5", "Bc4", "Nc6", "Bxf7"], "0-1"),
      g("c", ["Nge7", "e4"]),
      g("d", ["e4", "e5", "0-0"]),
    ]);
    await svc.setSelection(["json:hero"], { color: "white" });
    expect((await svc.query([])).next.map((n) => n.move)).toEqual(["e4"]);
    const r = await svc.query(["e4", "e5", "Bc4", "Nc6"]);
    expect(r.next).toHaveLength(1);
    expect(r.next[0]).toMatchObject({ move: "Bxf7+", stats: { total: 2, wins: 1, losses: 1 } });
    // a path typed without the check mark reaches the same node
    expect((await svc.query(["e4", "e5", "Bc4", "Nc6", "Bxf7"])).stats.total).toBe(2);
    expect((await svc.gamesAt(["e4", "e5", "Bc4", "Nc6", "Bxf7"], 10)).map((x) => x.game_id).sort()).toEqual(["a", "b"]);
    const e5 = await svc.query(["e4", "e5"]);
    expect(e5.stats.total).toBe(3);
    expect(e5.next.map((n) => [n.move, n.stats.total])).toEqual([["Bc4", 2]]); // 0-0 is not legal there
    // incremental board: jumping around still gives the right FEN
    expect((await svc.query(["e4"])).fen).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
    expect((await svc.query(["d4"])).fen).toBe("rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1");
  });
});

async function dbPut(playerId: string, games: Array<Record<string, unknown>>) {
  await db.players.put({ id: playerId, source: "json", username: playerId.split(":")[1], displayName: playerId.split(":")[1], gameCount: games.length, lastSyncedAt: null });
  await db.games.bulkAdd(games.map((x) => ({ ...x, source: "json", playerId, id: `${playerId}|${x.game_id}` })) as never);
}

describe("imports", () => {
  it("two PGN files without Site are both added", async () => {
    const a = `[White "Hero"]\n[Black "A"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n\n[White "Hero"]\n[Black "B"]\n[Result "0-1"]\n\n1. d4 d5 0-1\n`;
    const b = `[White "C"]\n[Black "Hero"]\n[Result "1-0"]\n\n1. c4 e5 1-0\n\n[White "D"]\n[Black "Hero"]\n[Result "0-1"]\n\n1. Nf3 d5 0-1\n`;
    expect((await svc.importGames({ kind: "pgn", username: "Hero", text: a }, noop)).added).toBe(2);
    expect((await svc.importGames({ kind: "pgn", username: "Hero", text: b }, noop)).added).toBe(2);
    expect((await svc.listPlayers())[0].gameCount).toBe(4);
  });

  it("skipped variants are counted in the outcome and the progress message", async () => {
    const games = JSON.parse(sampleJson).games;
    const text = JSON.stringify({ version: 1, games: [...games, { ...games[0], game_id: "zh", moves: ["e4", "d5", "exd5", "Qxd5", "N@f3"] }] });
    const progress: ImportProgress[] = [];
    const out = await svc.importGames({ kind: "json", username: "hero", text }, (p) => progress.push(p));
    expect(out).toMatchObject({ added: 3, skipped: 1 });
    expect(progress.at(-1)?.message).toBe("Skipped 1 non-standard game (variants or custom start positions)");
    const onlyVariants = JSON.stringify([{ ...games[0], moves: ["N@f3"] }]);
    await expect(svc.importGames({ kind: "json", username: "x", text: onlyVariants }, noop)).rejects.toThrow(/No standard games found.*1 non-standard/);
  });

  it("re-importing a web export goes back to the original player (no double count)", async () => {
    const s = new ExplorerService({ fetchImpl: chesscomFetch(["2024/01"]) as unknown as typeof fetch });
    await s.importGames({ kind: "chess.com", username: "Hero" }, noop);
    const exported = await s.exportPlayer("chess.com:hero");
    expect(exported).not.toContain("\n"); // compact
    const again = await s.importGames({ kind: "json", username: "my-file", text: exported }, noop);
    expect(again).toMatchObject({ added: 0, playerId: "chess.com:hero", playerIds: ["chess.com:hero"] });
    expect((await s.listPlayers()).map((p) => p.id)).toEqual(["chess.com:hero"]);
    // into an empty browser: recreates the chess.com player, which can then be synced
    await db.players.clear();
    await db.games.clear();
    const fresh = await s.importGames({ kind: "json", username: "my-file", text: exported }, noop);
    expect(fresh).toMatchObject({ added: 1, playerId: "chess.com:hero" });
    expect((await s.listPlayers())[0]).toMatchObject({ id: "chess.com:hero", source: "chess.com", username: "hero" });
  });

  it("unknown results ('*') are not counted anywhere", async () => {
    const games = JSON.parse(sampleJson).games;
    const text = JSON.stringify([...games, { ...games[0], game_id: "star", result: "*" }]);
    await svc.importGames({ kind: "json", username: "hero", text }, noop);
    const sel = await svc.setSelection(["json:hero"], {});
    expect(sel).toEqual({ games: 3, counts: { white: 2, black: 1 } });
    expect((await svc.gamesAt([], 10)).map((x) => x.game_id)).not.toContain("star");
  });

  it("a rolling date preset resolves at selection time", async () => {
    await svc.importGames(jsonReq, noop);
    expect((await svc.setSelection(["json:hero"], { date_preset: 30 })).games).toBe(0); // sample games are from 2025-12
    expect((await svc.setSelection(["json:hero"], { date_preset: 100000 })).games).toBe(3);
  });

  it("cancel stops every running import, file imports included", async () => {
    const big = JSON.stringify(Array.from({ length: 1200 }, (_, i) => ({ ...JSON.parse(sampleJson).games[0], game_id: `g${i}` })));
    const p = svc.importGames({ kind: "json", username: "a", text: big }, noop);
    const q = svc.importGames({ kind: "json", username: "b", text: big }, noop);
    await svc.cancelImport();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    await expect(q).rejects.toMatchObject({ name: "AbortError" });
  });
});
