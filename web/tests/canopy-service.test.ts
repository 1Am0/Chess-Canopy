import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { ExplorerService } from "@/lib/explorer-service";
import { db } from "@/lib/db";
import { FRONTIER, LEAF, NODE, ROOT, type CanopyTree } from "@/lib/canopy/types";
import { canopyBuffers } from "@/lib/engine/canopy-tree";

function synth(n: number, seed = 11) {
  let st = seed;
  const rnd = () => {
    st = (Math.imul(st, 1664525) + 1013904223) >>> 0;
    return st / 2 ** 32;
  };
  return Array.from({ length: n }, (_, g) => {
    const c = new Chess();
    const len = 4 + Math.floor(rnd() * 36);
    while (c.history().length < len && !c.isGameOver()) {
      const ms = c.moves();
      c.move(ms[Math.floor(rnd() ** 3 * ms.length)]);
    }
    const r = rnd();
    return {
      game_id: `g${g}`, moves: c.history(), result: r < 0.4 ? "1-0" : r < 0.7 ? "0-1" : "1/2-1/2", color: g % 3 === 0 ? "black" : "white",
      date: `2024-${String(1 + (g % 12)).padStart(2, "0")}-01`, opponent: `opp${g % 5}`, my_rating: 1500, opponent_rating: 1500,
      time_control: "blitz", time_control_raw: "180", termination: "", url: `https://x/${g}`,
    };
  });
}
const text = JSON.stringify({ version: 1, games: synth(200) });

let svc: ExplorerService;
beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  svc = new ExplorerService();
  await svc.importGames({ kind: "json", username: "hero", text }, () => {});
  await svc.setSelection("all", {});
});

const kids = (t: CanopyTree, i: number) => Array.from({ length: t.childCount[i] }, (_, j) => t.firstChild[i] + j);
const inf = { budgetMs: Infinity };

describe("ExplorerService.canopy", () => {
  it("root equals query([]) stats and next", async () => {
    const q = await svc.query([]);
    const t = await svc.canopy({ path: [], ...inf });
    expect(t.rootStats).toEqual(q.stats);
    expect(t.color).toBe(q.color);
    expect(t.selectionGames).toBe(q.games);
    expect(t.rootPly).toBe(0);
    expect(t.complete).toBe(true);
    expect(kids(t, 0).map((j) => [t.san[j], t.games[j], t.wins[j], t.draws[j], t.losses[j]])).toEqual(
      q.next.map((m) => [m.move, m.stats.total, m.stats.wins, m.stats.draws, m.stats.losses]),
    );
  });

  it("matches query() below a root line and honours the budget", async () => {
    const q = await svc.query(["e4"]);
    const t = await svc.canopy({ path: ["e4"], budgetMs: 0 });
    expect(t.rootPly).toBe(1);
    expect(t.rootStats).toEqual(q.stats);
    expect(kids(t, 0).map((j) => [t.san[j], t.games[j]])).toEqual(q.next.map((m) => [m.move, m.stats.total]));
    expect(t.complete).toBe(false);
    expect(Array.from(t.kind).includes(FRONTIER)).toBe(true);
    const full = await svc.canopy({ path: ["e4"], ...inf });
    expect(full.complete).toBe(true);
    expect(full.key).toBe(t.key);
  });

  it("changes with side and filters", async () => {
    await svc.setSelection("all", { color: "white" });
    const w = await svc.canopy({ path: [], ...inf });
    await svc.setSelection("all", { color: "black" });
    const b = await svc.canopy({ path: [], ...inf });
    expect(w.color).toBe("white");
    expect(b.color).toBe("black");
    expect(w.games[0]).not.toBe(b.games[0]);
    expect(w.key).not.toBe(b.key);
    await svc.setSelection("all", { color: "white", result: "1-0" });
    const wins = await svc.canopy({ path: [], ...inf });
    expect(wins.games[0]).toBeLessThan(w.games[0]);
    expect(wins.losses[0]).toBe(0);
    expect(wins.key).not.toBe(w.key);
  });

  it("rejects an invalid path", async () => {
    await expect(svc.canopy({ path: ["e4", "Qh8"] })).rejects.toThrow("Invalid move sequence");
  });

  it("handles out of book and an empty selection", async () => {
    const oob = await svc.canopy({ path: ["a3", "a6", "a4", "a5", "b3", "b6", "b4", "b5"] });
    expect(oob.n).toBe(1);
    expect(oob.games[0]).toBe(0);
    expect(oob.complete).toBe(true);
    expect(oob.kind[0]).toBe(ROOT);
    expect(oob.selectionGames).toBeGreaterThan(0);
    await svc.setSelection("all", { opponent: "nobody-at-all" });
    const empty = await svc.canopy({ path: [] });
    expect(empty.n).toBe(1);
    expect(empty.selectionGames).toBe(0);
    expect(empty.complete).toBe(true);
  });

  it("canopyGame returns the game for a leaf and null for a stale key", async () => {
    const t = await svc.canopy({ path: [], ...inf });
    const leaf = Array.from(t.kind).findIndex((k) => k === LEAF);
    expect(leaf).toBeGreaterThan(0);
    const g = await svc.canopyGame(t.key, t.leafRef[leaf]);
    expect(g).not.toBeNull();
    const full = [...t.path];
    for (let i = leaf; t.parent[i] >= 0; i = t.parent[i]) full.splice(t.path.length, 0, t.san[i]);
    expect(g!.moves.length).toBe(t.leafLen[leaf]);
    expect(await svc.canopyGame("nope|white|", 0)).toBeNull();
    await svc.canopy({ path: ["e4"], budgetMs: 0 });
    expect(await svc.canopyGame(t.key, t.leafRef[leaf])).toBeNull();
  });

  it("query() during a budgeted canopy returns correct results", async () => {
    const expected = await svc.query(["d4", "d5", "c4"]);
    const run = svc.canopy({ path: ["e4"], budgetMs: Infinity });
    const during = [await svc.query(["d4", "d5", "c4"]), await svc.query(["e4", "e5"]), await svc.query([])];
    const t = await run;
    expect(during[0]).toEqual(expected);
    expect(during[2].games).toBe(t.selectionGames);
    expect(await svc.query(["d4", "d5", "c4"])).toEqual(expected);
    expect(t.complete).toBe(true);
    // buffers are transferable
    expect(canopyBuffers(t).every((b) => b instanceof ArrayBuffer)).toBe(true);
  });

  it("a newer request stops an older growth early", async () => {
    const a = svc.canopy({ path: [], budgetMs: Infinity, seq: 1 });
    const b = svc.canopy({ path: ["e4"], budgetMs: Infinity, seq: 2 });
    const [ta, tb] = await Promise.all([a, b]);
    expect(tb.complete).toBe(true);
    // the older one was cut short at its first yield (it may still be complete on tiny data), never inconsistent
    expect(ta.rootStats).toEqual((await svc.query([])).stats);
    expect(Array.from(ta.kind).filter((k) => k === NODE || k === ROOT).length).toBeGreaterThan(0);
  });
});
