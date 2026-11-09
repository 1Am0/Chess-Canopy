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
    expect(out).toEqual({ added: 3, total: 3, playerId: "json:hero" });
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
