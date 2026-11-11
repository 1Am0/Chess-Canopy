import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { ExplorerService } from "@/lib/explorer-service";
import { db } from "@/lib/db";
import type { TreeNode } from "@/lib/engine/types";

let n = 0;
function game(moves: string[], result: "1-0" | "0-1" | "1/2-1/2" = "1-0") {
  n++;
  return {
    game_id: `t-${n}`,
    moves,
    result,
    color: "white",
    date: "2025-01-01",
    opponent: "opp",
    my_rating: 1500,
    opponent_rating: 1500,
    time_control: "blitz",
    time_control_raw: "300+0",
    termination: "Normal",
    url: `https://example.com/${n}`,
  };
}

// 4 x e4 e5 Nf3 (3 wins, 1 loss) / 3 x e4 c5 Nf3 / 2 x e4 e6 d4 / 1 x e4 c6 d4 / 2 x d4 d5 c4
const games = [
  ...[0, 0, 0].map(() => game(["e4", "e5", "Nf3", "Nc6"])),
  game(["e4", "e5", "Nf3", "Nc6"], "0-1"),
  ...[0, 0, 0].map(() => game(["e4", "c5", "Nf3", "d6"], "1/2-1/2")),
  ...[0, 0].map(() => game(["e4", "e6", "d4", "d5"])),
  game(["e4", "c6", "d4", "d5"]),
  ...[0, 0].map(() => game(["d4", "d5", "c4", "e6"])),
];

let svc: ExplorerService;
beforeEach(async () => {
  await db.players.clear();
  await db.games.clear();
  svc = new ExplorerService();
  await svc.importGames({ kind: "json", username: "hero", text: JSON.stringify({ version: 1, games }) }, () => {});
  await svc.setSelection(["json:hero"], {});
});

const sans = (t: TreeNode) => t.children.map((c) => c.san);

describe("tree", () => {
  it("builds the structure to the requested depth", async () => {
    const t = await svc.tree([], { depth: 3, breadth: 10 });
    expect(t.san).toBeNull();
    expect(t.path).toEqual([]);
    expect(t.stats.total).toBe(12);
    expect(sans(t)).toEqual(["e4", "d4"]);
    const e4 = t.children[0];
    expect(e4.path).toEqual(["e4"]);
    expect(sans(e4)).toEqual(["e5", "c5", "e6", "c6"]);
    expect(e4.children[0].children.map((c) => c.path)).toEqual([["e4", "e5", "Nf3"]]);
    expect(e4.children[0].children[0].children).toEqual([]); // depth 3 stops here
    expect(e4.children[0].stats).toMatchObject({ wins: 3, losses: 1, total: 4 });
  });

  it("starts below a non-empty path", async () => {
    const t = await svc.tree(["e4"], { depth: 1, breadth: 10 });
    expect(t.path).toEqual(["e4"]);
    expect(t.stats.total).toBe(10);
    expect(t.children[0].path).toEqual(["e4", "e5"]);
  });

  it("sorts by games descending", async () => {
    const t = await svc.tree(["e4"], { depth: 1, breadth: 10 });
    expect(t.children.map((c) => c.stats.total)).toEqual([4, 3, 2, 1]);
  });

  it("caps breadth and counts the pruned games", async () => {
    const t = await svc.tree(["e4"], { depth: 1, breadth: 2 });
    expect(sans(t)).toEqual(["e5", "c5"]);
    expect(t.otherGames).toBe(3);
    const full = await svc.tree(["e4"], { depth: 1, breadth: 10 });
    expect(full.otherGames).toBeUndefined();
  });

  it("drops children under minGames into otherGames", async () => {
    const t = await svc.tree(["e4"], { depth: 1, breadth: 10, minGames: 3 });
    expect(sans(t)).toEqual(["e5", "c5"]);
    expect(t.otherGames).toBe(3);
  });

  it("returns an empty root for an empty selection or an unplayed line", async () => {
    await svc.setSelection(["json:hero"], { opponent: "nobody" });
    const t = await svc.tree([], { depth: 3, breadth: 4 });
    expect(t).toMatchObject({ san: null, path: [], children: [] });
    expect(t.stats.total).toBe(0);
    await svc.setSelection(["json:hero"], {});
    const off = await svc.tree(["a3"], { depth: 2, breadth: 4 });
    expect(off.children).toEqual([]);
    expect(off.stats.total).toBe(0);
    await expect(svc.tree(["e5"], { depth: 2, breadth: 4 })).rejects.toThrow(/Invalid move/);
  });

  it("depth-1 stats match query(path).next", async () => {
    for (const path of [[], ["e4"], ["e4", "e5"]]) {
      const q = await svc.query(path);
      const t = await svc.tree(path, { depth: 1, breadth: 100 });
      expect(t.stats).toEqual(q.stats);
      expect(t.children.map((c) => ({ move: c.san, stats: c.stats }))).toEqual(q.next);
    }
  });

  it("deep nodes match a query of their own path", async () => {
    const t = await svc.tree([], { depth: 4, breadth: 10 });
    const check = async (node: TreeNode) => {
      for (const c of node.children) {
        expect(c.stats).toEqual((await svc.query(c.path)).stats);
        await check(c);
      }
    };
    await check(t);
  });
});
