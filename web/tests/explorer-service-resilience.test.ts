import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ExplorerService } from "@/lib/explorer-service";
import { db } from "@/lib/db";
import type { ChessComRawGame } from "@/lib/importers/chesscom";

const base = JSON.parse(readFileSync("tests/fixtures/api/chesscom_game.json", "utf8")) as ChessComRawGame;
const noop = () => {};

const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const archive = (m: string) => `https://api.chess.com/pub/player/hero/games/${m}`;
const gameOf = (m: string) => ({ ...base, url: `https://www.chess.com/game/live/${m.replace("/", "")}` });

/** Fetch mock: `fail` months answer 403; `onMonth` runs when a month is requested. */
function chesscom(months: string[], opts: { fail?: string[]; onMonth?: (m: string) => void } = {}): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/games/archives")) return jsonRes({ archives: months.map(archive) });
    const m = u.split("/").slice(-2).join("/");
    opts.onMonth?.(m);
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (opts.fail?.includes(m)) return jsonRes({ message: "blocked" }, 403);
    return jsonRes({ games: [gameOf(m)] });
  }) as unknown as typeof fetch;
}

beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
});

describe("chess.com import saves incrementally", () => {
  const months = ["2024/01", "2024/02", "2024/03"];

  it("keeps the months downloaded before a failed month and reports a partial outcome", async () => {
    const svc = new ExplorerService({ fetchImpl: chesscom(months, { fail: ["2024/03"] }) });
    const out = await svc.importGames({ kind: "chess.com", username: "Hero" }, noop);
    expect(out.added).toBe(2);
    expect(out.partial).toMatch(/Run Sync to retry/);
    const [p] = await svc.listPlayers();
    expect(p).toMatchObject({ id: "chess.com:hero", gameCount: 2, lastSyncedMonth: "2024/02" });

    // The next sync resumes at the failed month and advances the watermark.
    const healed = new ExplorerService({ fetchImpl: chesscom(months) });
    const again = await healed.syncPlayer("chess.com:hero", noop);
    expect(again.partial).toBeUndefined();
    expect(again.added).toBe(1);
    expect((await healed.listPlayers())[0]).toMatchObject({ gameCount: 3, lastSyncedMonth: "2024/03" });
  });

  it("a failure before anything was saved still throws and stores nothing", async () => {
    const svc = new ExplorerService({ fetchImpl: chesscom(months, { fail: ["2024/01"] }) });
    await expect(svc.importGames({ kind: "chess.com", username: "Hero" }, noop)).rejects.toThrow(/403/);
    expect(await svc.listPlayers()).toEqual([]);
  });

  it("cancelling keeps the months already saved", async () => {
    const svc: ExplorerService = new ExplorerService({
      fetchImpl: chesscom(months, { onMonth: (m) => m === "2024/03" && void svc.cancelImport() }),
    });
    await expect(svc.importGames({ kind: "chess.com", username: "Hero" }, noop)).rejects.toMatchObject({ name: "AbortError" });
    const [p] = await svc.listPlayers();
    expect(p.gameCount).toBe(2);
    expect(p.lastSyncedMonth).toBe("2024/02");
  });
});

describe("gamesAt paging", () => {
  it("returns further pages with an offset", async () => {
    const games = Array.from({ length: 60 }, (_, i) => ({
      game_id: `g${String(i).padStart(2, "0")}`,
      moves: ["e4", "e5"],
      result: "1-0",
      color: "white",
      date: `2024-01-${String((i % 28) + 1).padStart(2, "0")}`,
      opponent: "x",
      my_rating: 1500,
      opponent_rating: 1500,
      time_control: "blitz",
      time_control_raw: "180",
      termination: "",
      url: "",
    }));
    const svc = new ExplorerService();
    await svc.importGames({ kind: "json", username: "hero", text: JSON.stringify({ version: 1, games }) }, noop);
    await svc.setSelection("all", {});
    const first = await svc.gamesAt([], 25);
    const second = await svc.gamesAt([], 25, 25);
    const rest = await svc.gamesAt([], 25, 50);
    expect([first.length, second.length, rest.length]).toEqual([25, 25, 10]);
    expect(new Set([...first, ...second, ...rest].map((g) => g.game_id)).size).toBe(60);
    expect(await svc.gamesAt([], 25, 60)).toEqual([]);
  });
});

describe("import input", () => {
  const pgn = (res: string, name: string) =>
    `[Event "x"]\n[Site "https://lichess.org/${name}"]\n[Date "2024.01.01"]\n[White "Hero"]\n[Black "Foe"]\n[Result "${res}"]\n\n1. e4 e5 ${res}\n`;

  it("reads a File/Blob inside the service", async () => {
    const svc = new ExplorerService();
    const out = await svc.importGames({ kind: "pgn", username: "hero", file: new Blob([pgn("1-0", "aaaaaaaa")]) }, noop);
    expect(out.added).toBe(1);
  });

  it("does not store unfinished games and reports them", async () => {
    const svc = new ExplorerService();
    const progress: string[] = [];
    const out = await svc.importGames(
      { kind: "pgn", username: "hero", text: pgn("1-0", "aaaaaaaa") + "\n" + pgn("*", "bbbbbbbb") },
      (p) => p.message && progress.push(p.message),
    );
    expect(out).toMatchObject({ added: 1, total: 1, unfinished: 1 });
    expect(progress.at(-1)).toMatch(/1 game without a result/);
    await expect(
      svc.importGames({ kind: "pgn", username: "hero", text: pgn("*", "cccccccc") }, noop),
    ).rejects.toThrow(/No finished games/);
  });
});

describe("QueryResult.fen", () => {
  it("reports the path's position even when no game matches", async () => {
    const svc = new ExplorerService();
    await svc.importGames({ kind: "pgn", username: "hero", text: `[White "Hero"]\n[Black "F"]\n[Result "1-0"]\n[Date "2024.01.01"]\n[Site "https://lichess.org/zzzzzzzz"]\n\n1. e4 e5 1-0\n` }, noop);
    await svc.setSelection("all", { opponent: "nobody" });
    expect((await svc.query(["e4"])).fen).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
  });
});
