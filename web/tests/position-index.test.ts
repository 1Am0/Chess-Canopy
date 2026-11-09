import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { buildColorTries, filterGames } from "@/lib/engine/filter";
import { GameIndex, sanKey } from "@/lib/engine/position-index";
import { nextMovesForPath } from "@/lib/engine/trie";
import type { Filters, Game } from "@/lib/engine/types";

const golden = JSON.parse(readFileSync("tests/fixtures/golden/explorer_golden.json", "utf8"));
const sample = JSON.parse(readFileSync("tests/fixtures/golden/sample_games.json", "utf8"));
const games: Game[] = sample.games.map((g: Game) => ({ ...g, source: "json", playerId: "json:x" }));

function boardFor(path: string[]) {
  return (d: number) => {
    const c = new Chess();
    for (const m of path.slice(0, d)) c.move(m);
    return c;
  };
}

const mk = (moves: string, o: Partial<Game> = {}): Game => ({
  game_id: moves, moves: moves ? moves.split(" ") : [], result: "1-0", color: "white", date: "2024-01-01", opponent: "o",
  my_rating: null, opponent_rating: null, time_control: "blitz", time_control_raw: "", termination: "", url: "", source: "json", playerId: "json:x", ...o,
});

describe("GameIndex", () => {
  it("matches the eager trie on every golden case (legal and raw mode)", () => {
    let n = 0;
    for (const c of golden.cases as Array<{ filters: Filters; color: "white" | "black"; path: string[]; stats: unknown; next: unknown }>) {
      const filtered = filterGames(games, c.filters);
      const eager = nextMovesForPath(buildColorTries(filtered)[c.color], c.path);
      for (const legal of [true, false]) {
        if (legal && c.filters.moves_start) continue;
        const idx = new GameIndex(filtered.filter((g) => g.color === c.color), legal);
        const node = idx.nodeAt(c.path, boardFor(c.path));
        const stats = node ? GameIndex.stats(node) : eager.stats;
        const next = node ? idx.next(node, c.path.length, boardFor(c.path)) : [];
        expect(stats, JSON.stringify(c)).toEqual(c.stats);
        expect(next, JSON.stringify(c)).toEqual(c.next);
        expect(next).toEqual(eager.next);
        n++;
      }
    }
    expect(n).toBeGreaterThan(150);
  });

  it("legal mode merges check-mark variants and drops illegal moves", () => {
    const idx = new GameIndex(
      [mk("e4 e5 Bc4 Nc6 Bxf7+"), mk("e4 e5 Bc4 Nc6 Bxf7", { result: "0-1" }), mk("e4 e5 Bc4 Nc6 0-0"), mk("Nge7 d5"), mk("e4 e5 Bc4 Nc6 Qh5")],
      true,
    );
    expect(idx.next(idx.root, 0, boardFor([])).map((n) => n.move)).toEqual(["e4"]); // Nge7 is illegal for White
    const path = ["e4", "e5", "Bc4", "Nc6"];
    const node = idx.nodeAt(path, boardFor(path))!;
    const next = idx.next(node, 4, boardFor(path));
    expect(next.map((n) => [n.move, n.stats.total])).toEqual([["Bxf7+", 2], ["Qh5", 1]]); // 0-0 illegal (Nf3 missing)
    expect(next[0].stats).toMatchObject({ wins: 1, losses: 1 });
    // raw mode keeps the stored keys, exactly like the eager trie
    const raw = new GameIndex(idx.games, false);
    const rn = raw.nodeAt(path, () => { throw new Error("raw mode needs no board"); })!;
    expect(raw.next(rn, 4, () => { throw new Error("no board"); }).map((n) => n.move).sort()).toEqual(["0-0", "Bxf7", "Bxf7+", "Qh5"]);
  });

  it("resolves non-canonical notation with chess.js", () => {
    const idx = new GameIndex([mk("e4 e5 Ng1f3"), mk("e4 e5 Nf3")], true);
    const node = idx.nodeAt(["e4", "e5"], boardFor(["e4", "e5"]))!;
    expect(idx.next(node, 2, boardFor(["e4", "e5"])).map((n) => [n.move, n.stats.total])).toEqual([["Nf3", 2]]);
  });

  it("keeps game order (newest first) in each node and skips unknown results", () => {
    const list = [mk("e4 e5", { game_id: "a" }), mk("d4", { game_id: "b" }), mk("e4 c5", { game_id: "c", result: "*" }), mk("e4", { game_id: "d" })];
    const idx = new GameIndex(list, true);
    expect(GameIndex.stats(idx.root).total).toBe(3);
    const node = idx.nodeAt(["e4"], boardFor(["e4"]))!;
    expect([...node.idx].map((i) => idx.games[i].game_id)).toEqual(["a", "d"]);
  });

  it("sanKey", () => {
    expect(sanKey("Qh4#")).toBe("Qh4");
    expect(sanKey("e4!?")).toBe("e4");
    expect(sanKey("0-0-0+")).toBe("O-O-O");
    expect(sanKey("Nf3")).toBe("Nf3");
  });
});
