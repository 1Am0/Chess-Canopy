import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildColorTries, filterGames } from "@/lib/engine/filter";
import { Trie, compareCodePoints, nextMovesForPath } from "@/lib/engine/trie";
import type { Filters, Game } from "@/lib/engine/types";

const golden = JSON.parse(readFileSync("tests/fixtures/golden/explorer_golden.json", "utf8"));
const sample = JSON.parse(readFileSync("tests/fixtures/golden/sample_games.json", "utf8"));
const games: Game[] = sample.games.map((g: Game) => ({ ...g, source: "json", playerId: "json:x" }));

describe("golden parity", () => {
  it("has cases", () => expect(golden.cases.length).toBeGreaterThan(50));
  for (const c of golden.combos as Array<{ filters: Filters; filtered_count: number }>) {
    it(`combo ${JSON.stringify(c.filters)}`, () => {
      expect(filterGames(games, c.filters)).toHaveLength(c.filtered_count);
    });
  }
  golden.cases.forEach((c: { filters: Filters; color: "white" | "black"; path: string[]; filtered_count: number; stats: unknown; next: unknown }, i: number) => {
    it(`case ${i} ${JSON.stringify(c.filters)} ${c.color} [${c.path}]`, () => {
      const filtered = filterGames(games, c.filters);
      expect(filtered).toHaveLength(c.filtered_count);
      const r = nextMovesForPath(buildColorTries(filtered)[c.color], c.path);
      expect(r.stats).toEqual(c.stats);
      expect(r.next).toEqual(c.next);
    });
  });
});

const mk = (o: Partial<Game>): Game => ({
  game_id: "x", moves: ["e4", "e5", "Nf3"], result: "1-0", color: "white", date: "2024-05-10", opponent: "Bob",
  my_rating: 1500, opponent_rating: 1400, time_control: "blitz", time_control_raw: "300+0", termination: "", url: "",
  source: "json", playerId: "json:x", ...o,
});

describe("trie", () => {
  it("handles result tokens", () => {
    const t = new Trie();
    for (const r of ["1-0", " WIN ", "w", "0-1", "loss", "1/2-1/2", "=", "½", "D"]) t.addGame(["e4"], r);
    expect(t.stats(["e4"])).toMatchObject({ wins: 3, losses: 2, draws: 4, total: 9 });
    expect(t.stats([]).total).toBe(9);
    expect(t.stats(["d4"]).total).toBe(0);
    expect(t.find(["e4", "e5"])).toBeNull();
  });
  it("throws on unknown token without mutating", () => {
    const t = new Trie();
    expect(() => t.addGame(["e4"], "*")).toThrow();
    expect(t.stats([]).total).toBe(0);
  });
  it("sorts total desc then move desc", () => {
    const t = new Trie();
    t.addGame(["a3"], "1-0");
    t.addGame(["b3"], "1-0");
    t.addGame(["Nf3"], "1-0");
    t.addGame(["e4"], "1-0");
    t.addGame(["e4"], "0-1");
    const r = nextMovesForPath(t, []);
    expect(r.next.map((n) => n.move)).toEqual(["e4", "b3", "a3", "Nf3"]);
    expect(nextMovesForPath(t, ["zz"])).toEqual({ stats: t.stats(["zz"]), next: [] });
  });
  it("compares by code point", () => {
    expect(compareCodePoints("a", "b")).toBeLessThan(0);
    expect(compareCodePoints("\u{1F600}", "￿")).toBeGreaterThan(0);
    expect(compareCodePoints("ab", "a")).toBeGreaterThan(0);
  });
});

describe("filterGames", () => {
  it("case-insensitive opponent", () => expect(filterGames([mk({ opponent: "BoB" })], { opponent: "bOb" })).toHaveLength(1));
  it("inclusive dates", () => {
    const g = [mk({ date: "2024-05-10" })];
    expect(filterGames(g, { date_from: "2024-05-10", date_to: "2024-05-10" })).toHaveLength(1);
    expect(filterGames(g, { date_from: "2024-05-11" })).toHaveLength(0);
    expect(filterGames(g, { date_to: "2024-05-09" })).toHaveLength(0);
    expect(filterGames([mk({ date: "" })], { date_from: "2020-01-01" })).toHaveLength(0);
    expect(filterGames(g, { date_from: "garbage" })).toHaveLength(1);
  });
  it("null rating fails bounds; 0 is a value", () => {
    expect(filterGames([mk({ my_rating: null })], { min_my_rating: 0 })).toHaveLength(0);
    expect(filterGames([mk({ opponent_rating: null })], { max_opponent_rating: 9999 })).toHaveLength(0);
    expect(filterGames([mk({ my_rating: null })], {})).toHaveLength(1);
    expect(filterGames([mk({ my_rating: 0 })], { min_my_rating: 0, max_my_rating: 0 })).toHaveLength(1);
  });
  it("move slice is 0-based, end exclusive, no mutation", () => {
    const g = mk({});
    expect(filterGames([g], { moves_start: 1, moves_end: 2 })[0].moves).toEqual(["e5"]);
    expect(filterGames([g], { moves_start: 1 })[0].moves).toEqual(["e5", "Nf3"]);
    expect(filterGames([g], { moves_end: -1 })[0].moves).toEqual(["e4", "e5"]);
    expect(g.moves).toHaveLength(3);
  });
  it("color/result/time control", () => {
    const g = [mk({}), mk({ color: "black", result: "0-1", time_control: "rapid", time_control_raw: "600" })];
    expect(filterGames(g, { color: "black" })).toHaveLength(1);
    expect(filterGames(g, { result: "1-0" })).toHaveLength(1);
    expect(filterGames(g, { time_control: "rapid" })).toHaveLength(1);
    expect(filterGames(g, { time_control_raw: "300+0" })).toHaveLength(1);
    expect(filterGames(g, { color: null, result: null })).toHaveLength(2);
  });
  it("buildColorTries skips unknown results like *", () => {
    const t = buildColorTries([mk({ result: "*" }), mk({}), mk({ color: "black", result: "0-1" })]);
    expect(t.white.stats([]).total).toBe(1);
    expect(t.black.stats(["e4"]).losses).toBe(1);
  });
});
