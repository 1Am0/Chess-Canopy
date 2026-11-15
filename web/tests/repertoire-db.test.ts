import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import { CanopyDB, db, deletePlayer, deleteRepertoireEntry, listRepertoire, putRepertoireEntry, saveGames } from "@/lib/db";
import { ExplorerService } from "@/lib/explorer-service";
import type { Game } from "@/lib/engine/types";
import type { NewRepertoireEntry } from "@/lib/repertoire/types";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const START_EPD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const AFTER_E4_EPD = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -";

const entry = (over: Partial<NewRepertoireEntry> = {}): NewRepertoireEntry => ({
  side: "white",
  epd: START_EPD,
  fen: START,
  san: "e4",
  line: [],
  ...over,
});

let n = 0;
function game(moves: string[], date: string, time_control: string, color: "white" | "black" = "white", result = "1-0"): Game {
  n++;
  return {
    game_id: `g${n}`, moves, result, color, date, opponent: "opp", my_rating: null, opponent_rating: null, time_control,
    time_control_raw: "", termination: "", url: "", source: "json", playerId: "json:hero",
  };
}

beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  await db.repertoire.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("repertoire storage", () => {
  it("puts, lists per side and deletes entries", async () => {
    const a = await putRepertoireEntry(entry());
    expect(a).toMatchObject({ id: `white|${START_EPD}`, side: "white", epd: START_EPD, san: "e4", line: [] });
    await putRepertoireEntry(entry({ side: "black", epd: AFTER_E4_EPD, fen: AFTER_E4, san: "c5", line: ["e4"] }));
    expect((await listRepertoire("white")).map((e) => e.san)).toEqual(["e4"]);
    expect((await listRepertoire("black")).map((e) => [e.id, e.san, e.line])).toEqual([[`black|${AFTER_E4_EPD}`, "c5", ["e4"]]]);
    await deleteRepertoireEntry("white", START_EPD);
    await deleteRepertoireEntry("white", "missing"); // no-op
    expect(await listRepertoire("white")).toEqual([]);
    expect(await listRepertoire("black")).toHaveLength(1);
  });

  it("keeps lockedAt when the same move is saved again, and resets it for a different move", async () => {
    // (fake timers would stall fake-indexeddb, so only Date.now is mocked)
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const first = await putRepertoireEntry(entry({ line: [] }));
    expect(first.lockedAt).toBe(1_000);
    now.mockReturnValue(2_000);
    const same = await putRepertoireEntry(entry({ line: ["x"] }));
    expect(same.lockedAt).toBe(1_000);
    expect(same.line).toEqual(["x"]);
    now.mockReturnValue(3_000);
    const other = await putRepertoireEntry(entry({ san: "d4" }));
    expect(other.lockedAt).toBe(3_000);
    expect(await listRepertoire("white")).toEqual([other]);
  });

  it("deletePlayer leaves the repertoire alone", async () => {
    await saveGames({ id: "json:hero", source: "json", username: "hero", displayName: "hero" }, [game(["e4"], "2024-01-01", "blitz")]);
    await putRepertoireEntry(entry());
    await deletePlayer("json:hero");
    expect(await db.games.count()).toBe(0);
    expect(await listRepertoire("white")).toHaveLength(1);
  });
});

describe("DB v3 migration", () => {
  it("keeps v2 data and adds the repertoire table", async () => {
    const name = "canopy-migration-v3-test";
    const v2 = new Dexie(name);
    v2.version(2).stores({ players: "&id, source", games: "&id, playerId, date" });
    await v2.open();
    await v2.table("players").put({ id: "json:hero", source: "json", username: "hero", displayName: "hero", gameCount: 1, lastSyncedAt: 1 });
    await v2.table("games").put({ ...game(["e4", "e5"], "2024-01-01", "blitz"), id: "json:hero|g" });
    v2.close();

    const v3 = new CanopyDB(name);
    await v3.open();
    expect(v3.verno).toBe(3);
    expect(await v3.players.count()).toBe(1);
    expect((await v3.games.toArray()).map((g) => g.id)).toEqual(["json:hero|g"]);
    expect(await v3.repertoire.count()).toBe(0);
    await v3.repertoire.put({ id: "white|x", side: "white", epd: "x", fen: START, san: "e4", line: [], lockedAt: 1 });
    expect(await v3.repertoire.where("side").equals("white").count()).toBe(1);
    v3.close();
    await Dexie.delete(name);
  });
});

describe("ExplorerService repertoire", () => {
  const hero = { id: "json:hero", source: "json" as const, username: "hero", displayName: "hero" };

  async function seed() {
    const games = [
      ...[1, 2, 3, 4, 5].map((d) => game(["e4", "e5"], `2024-01-0${d}`, "blitz")),
      ...[1, 2, 3].map((d) => game(["d4", "d5"], `2024-02-0${d}`, "rapid")),
      game(["e4", "e5"], "2024-03-01", "bullet", "black"),
      game(["e4", "e5"], "2024-03-02", "", "white"),
      game(["e4", "e5"], "2024-03-03", "blitz", "white", "*"),
    ];
    await saveGames(hero, games);
  }

  it("auto picks the most played time control and leaves the explorer's selection alone", async () => {
    await seed();
    const svc = new ExplorerService();
    await svc.setSelection(["json:hero"], { color: "white", time_control: "rapid" });
    const before = await svc.query([]);
    const tree = await svc.tree([], { depth: 2, breadth: 5 });

    const r = await svc.repertoireReport(["json:hero"], { side: "white", timeControl: "auto", maxMove: 12 });
    expect(r.side).toBe("white");
    expect(r.timeControl).toBe("blitz");
    expect(r.maxMove).toBe(12);
    expect(r.games).toBe(5);
    expect(r.timeControls).toEqual([
      { timeControl: "blitz", games: 5 },
      { timeControl: "rapid", games: 3 },
    ]);
    expect(r.points).toHaveLength(1);
    expect(r.points[0].main).toBe("e4");
    expect(r.deviations).toEqual([]);

    expect(await svc.query([])).toEqual(before);
    expect(await svc.tree([], { depth: 2, breadth: 5 })).toEqual(tree);

    const all = await svc.repertoireReport("all", { side: "white", timeControl: null, maxMove: Number.NaN });
    expect(all.timeControl).toBeNull();
    expect(all.games).toBe(9); // including the game without a time control, not the unfinished one
    expect(all.maxMove).toBe(12);
    const rapid = await svc.repertoireReport(["json:hero"], { side: "white", timeControl: "rapid", maxMove: 99 });
    expect(rapid.games).toBe(3);
    expect(rapid.maxMove).toBe(40);
    expect(rapid.points[0].main).toBe("d4");
  });

  it("saves, validates and deletes repertoire moves, and the report follows", async () => {
    await seed();
    const svc = new ExplorerService();
    const opts = { side: "white" as const, timeControl: null, maxMove: 1 };
    const r1 = await svc.repertoireReport(["json:hero"], opts);
    expect(r1.points[0].locked).toBeNull();

    await expect(svc.saveRepertoireMove(entry({ san: "e5" }))).rejects.toThrow("Illegal repertoire move");
    await expect(svc.saveRepertoireMove(entry({ epd: AFTER_E4_EPD }))).rejects.toThrow("Illegal repertoire move");
    await expect(svc.saveRepertoireMove(entry({ fen: "not a fen" }))).rejects.toThrow("Illegal repertoire move");
    await expect(svc.saveRepertoireMove(entry({ side: "black" }))).rejects.toThrow("Illegal repertoire move");

    const saved = await svc.saveRepertoireMove(entry({ san: "Pd2-d4" }));
    expect(saved.san).toBe("d4");
    expect(await svc.listRepertoire("white")).toEqual([saved]);

    const r2 = await svc.repertoireReport(["json:hero"], opts);
    expect(r2.points[0].locked).toBe("d4");
    expect(r2.points[0].main).toBe("d4");

    await svc.deleteRepertoireMove("white", START_EPD);
    expect(await svc.listRepertoire("white")).toEqual([]);
    const r3 = await svc.repertoireReport(["json:hero"], opts);
    expect(r3.points[0].locked).toBeNull();
  });
});
