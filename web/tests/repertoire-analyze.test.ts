import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { analyzeRepertoire, detectSwitch, epdOf, play } from "@/lib/repertoire/analyze";
import type { Color, Game } from "@/lib/engine/types";
import type { RepertoireEntry } from "@/lib/repertoire/types";
import { START_FEN } from "@/lib/importers/standard";

let n = 0;
function game(moves: string[], date: string, result = "1-0", color: Color = "white"): Game {
  n++;
  return {
    game_id: `g${n}`,
    moves,
    result,
    color,
    date,
    opponent: "opp",
    my_rating: 1500,
    opponent_rating: 1500,
    time_control: "blitz",
    time_control_raw: "180",
    termination: "",
    url: `https://example.test/${n}`,
    source: "json",
    playerId: "json:hero",
  };
}

const newestFirst = (gs: Game[]) => [...gs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
const day = (i: number) => `2024-01-${String(i).padStart(2, "0")}`;
const START_EPD = epdOf(START_FEN);
const epdAfter = (moves: string[]) => {
  const c = new Chess();
  for (const m of moves) c.move(m);
  return epdOf(c.fen());
};
const lock = (side: Color, line: string[], san: string, lockedAt: number): RepertoireEntry => {
  const c = new Chess();
  for (const m of line) c.move(m);
  const epd = epdOf(c.fen());
  return { id: `${side}|${epd}`, side, epd, fen: c.fen(), san, line, lockedAt };
};

describe("analyzeRepertoire", () => {
  it("computes moves, consistency and priority", () => {
    const gs = newestFirst([
      game(["e4", "e5"], day(1), "1-0"),
      game(["d4", "d5"], day(2), "0-1"),
      game(["e4", "c5"], day(3), "1/2-1/2"),
      game(["d4", "Nf6"], day(4), "1-0"),
      game(["e4", "e6"], day(5), "1-0"),
      game(["d4", "d5"], day(6), "1-0"),
      game(["e4", "e5"], day(7), "0-1"),
      game(["e4", "e5"], day(8), "1-0"),
    ]);
    const { points, deviations } = analyzeRepertoire(gs, { side: "white", maxMove: 1, locked: [] });
    expect(deviations).toEqual([]);
    expect(points).toHaveLength(1);
    const p = points[0];
    expect(p.epd).toBe(START_EPD);
    expect(p.fen).toBe(START_FEN);
    expect(p.line).toEqual([]);
    expect(p.moveNumber).toBe(1);
    expect(p.games).toBe(8);
    expect(p.switch).toBeNull();
    expect(p.main).toBe("e4");
    expect(p.locked).toBeNull();
    expect(p.consistency).toBeCloseTo(5 / 8);
    expect(p.priority).toBe(3);
    expect(p.moves.map((m) => [m.san, m.games, m.wins, m.draws, m.losses, m.firstDate, m.lastDate])).toEqual([
      ["e4", 5, 3, 1, 1, day(1), day(8)],
      ["d4", 3, 2, 0, 1, day(2), day(6)],
    ]);
    expect(p.moves[0].fenAfter).toBe(new Chess().move("e4").after);
  });

  it("merges transpositions into one position and picks the most common move order", () => {
    const a = ["d4", "Nf6", "c4", "e6"];
    const b = ["c4", "e6", "d4", "Nf6"];
    const gs = newestFirst([
      game([...a, "Nc3"], day(1)),
      game([...a, "Nc3"], day(2)),
      game([...b, "Nf3"], day(3)),
    ]);
    const { points } = analyzeRepertoire(gs, { side: "white", maxMove: 3, locked: [] });
    const p = points.find((x) => x.epd === epdAfter(a));
    expect(p).toBeDefined();
    expect(p!.games).toBe(3);
    expect(p!.line).toEqual(a);
    expect(p!.moveNumber).toBe(3);
    expect(p!.moves.map((m) => [m.san, m.games])).toEqual([
      ["Nc3", 2],
      ["Nf3", 1],
    ]);
  });

  it("breaks a move-order tie by the newest game", () => {
    const a = ["d4", "Nf6", "c4", "e6"];
    const b = ["c4", "e6", "d4", "Nf6"];
    const gs = newestFirst([game([...a, "Nc3"], day(1)), game([...b, "Nc3"], day(5)), game([...a, "Nc3"], day(2)), game([...b, "Nc3"], day(3))]);
    const p = analyzeRepertoire(gs, { side: "white", maxMove: 3, locked: [] }).points.find((x) => x.epd === epdAfter(a));
    expect(p!.line).toEqual(b);
  });

  it("drops positions with fewer than MIN_GAMES games", () => {
    const gs = newestFirst([game(["e4", "e5", "Nf3"], day(1)), game(["e4", "e5", "Nf3"], day(2)), game(["e4", "c5", "Nf3"], day(3))]);
    const { points } = analyzeRepertoire(gs, { side: "white", maxMove: 2, locked: [] });
    expect(points.map((p) => p.epd)).toEqual([START_EPD]); // after 1.e4 e5 only 2 games, after 1.e4 c5 only 1
  });

  it("counts a game once per position even when the position repeats", () => {
    const rep = ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8", "e4"];
    const gs = newestFirst([game(rep, day(1)), game(rep, day(2)), game(rep, day(3))]);
    const { points } = analyzeRepertoire(gs, { side: "white", maxMove: 5, locked: [] });
    const start = points.find((p) => p.epd === START_EPD)!;
    expect(start.games).toBe(3);
    expect(start.moves.map((m) => [m.san, m.games])).toEqual([["Nf3", 3]]);
  });

  it("stops at maxMove for White", () => {
    const line = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"];
    const gs = newestFirst([game(line, day(1)), game(line, day(2)), game(line, day(3))]);
    const two = analyzeRepertoire(gs, { side: "white", maxMove: 2, locked: [] }).points;
    expect(two.map((p) => p.moveNumber).sort()).toEqual([1, 2]);
    expect(two.find((p) => p.moveNumber === 2)!.main).toBe("Nf3");
    const three = analyzeRepertoire(gs, { side: "white", maxMove: 3, locked: [] }).points;
    expect(three.map((p) => p.moveNumber).sort()).toEqual([1, 2, 3]);
  });

  it("stops at maxMove for Black", () => {
    const line = ["e4", "c5", "Nf3", "d6", "d4", "cxd4"];
    const gs = newestFirst([game(line, day(1), "1-0", "black"), game(line, day(2), "1-0", "black"), game(line, day(3), "1-0", "black")]);
    const one = analyzeRepertoire(gs, { side: "black", maxMove: 1, locked: [] }).points;
    expect(one).toHaveLength(1);
    expect(one[0].epd).toBe(epdAfter(["e4"]));
    expect(one[0].main).toBe("c5");
    expect(one[0].moveNumber).toBe(1);
    expect(one[0].line).toEqual(["e4"]);
    const two = analyzeRepertoire(gs, { side: "black", maxMove: 2, locked: [] }).points;
    expect(two.map((p) => [p.moveNumber, p.main]).sort()).toEqual([
      [1, "c5"],
      [2, "d6"],
    ]);
  });

  it("detects a clean switch", () => {
    const gs = newestFirst([
      ...[1, 2, 3, 4].map((d) => game(["e4"], day(d))),
      ...[1, 2, 3, 4, 5, 6].map((d) => game(["d4"], `2024-02-0${d}`)),
    ]);
    const [p] = analyzeRepertoire(gs, { side: "white", maxMove: 1, locked: [] }).points;
    expect(p.switch).toEqual({ from: "e4", to: "d4", date: "2024-02-01", gamesSince: 6 });
    expect(p.main).toBe("d4");
    expect(p.moves[0].san).toBe("d4");
    expect(p.consistency).toBe(1);
    expect(p.priority).toBe(0);
    expect(p.games).toBe(10);
  });

  it("finds no switch when the moves stay mixed", () => {
    const gs = newestFirst(Array.from({ length: 12 }, (_, i) => game([i % 2 ? "e4" : "d4"], day(i + 1))));
    const [p] = analyzeRepertoire(gs, { side: "white", maxMove: 1, locked: [] }).points;
    expect(p.switch).toBeNull();
    expect(p.consistency).toBeCloseTo(0.5);
    expect(p.priority).toBe(6);
    expect(p.main).toBe("d4"); // 6 each: san ascending
  });

  it("detectSwitch picks the earliest qualifying date and needs games before it", () => {
    expect(detectSwitch(Array.from({ length: 6 }, (_, i) => ({ date: day(i + 1), san: "d4" })))).toBeNull();
    const v = [
      { date: day(1), san: "e4" },
      { date: day(2), san: "e4" },
      { date: day(3), san: "d4" },
      { date: day(4), san: "d4" },
      { date: day(5), san: "d4" },
      { date: day(6), san: "d4" },
      { date: day(7), san: "d4" },
      { date: day(8), san: "d4" },
    ];
    expect(detectSwitch(v)).toEqual({ from: "e4", to: "d4", date: day(3), gamesSince: 6 });
    // too few games since the change
    expect(detectSwitch(v.slice(0, 6))).toBeNull();
  });

  it("detectSwitch dates the switch from the first game with the new move", () => {
    // 6 old games then 9 new: the earliest qualifying date is the last old game (1 of 10 = 90% new),
    // but the switch is reported from the first game that played the new move.
    const v = [
      ...Array.from({ length: 6 }, (_, i) => ({ date: day(i + 1), san: "Bc4" })),
      ...Array.from({ length: 9 }, (_, i) => ({ date: day(i + 10), san: "Bb5" })),
    ];
    expect(detectSwitch(v)).toEqual({ from: "Bc4", to: "Bb5", date: day(10), gamesSince: 9 });
  });

  it("uses the locked move as main and for consistency", () => {
    const gs = newestFirst([game(["e4"], day(1)), game(["d4"], day(2)), game(["d4"], day(3)), game(["c4"], day(4))]);
    const locked = [lock("white", [], "e4", Date.UTC(2023, 0, 1)), lock("black", [], "c4", 0)];
    const [p] = analyzeRepertoire(gs, { side: "white", maxMove: 1, locked }).points;
    expect(p.locked).toBe("e4");
    expect(p.main).toBe("e4");
    expect(p.consistency).toBeCloseTo(0.25);
    expect(p.priority).toBe(3);
  });

  it("sorts points by priority, then games, then move number", () => {
    const gs = newestFirst([
      game(["e4", "e5", "Nf3"], day(1)),
      game(["e4", "e5", "Nf3"], day(2)),
      game(["e4", "e5", "Bc4"], day(3)),
      game(["e4", "c5", "Nf3"], day(4)),
      game(["e4", "c5", "Nf3"], day(5)),
      game(["e4", "c5", "Nf3"], day(6)),
    ]);
    const pts = analyzeRepertoire(gs, { side: "white", maxMove: 2, locked: [] }).points;
    expect(pts.map((p) => [p.epd, p.priority, p.games])).toEqual([
      [epdAfter(["e4", "e5"]), 1, 3],
      [START_EPD, 0, 6],
      [epdAfter(["e4", "c5"]), 0, 3],
    ]);
  });

  it("reports deviations from the locked moves on or after the lock day, first per game, newest first", () => {
    const locked = [lock("white", [], "e4", Date.UTC(2024, 1, 1, 15)), lock("white", ["e4", "e5"], "Nf3", Date.UTC(2024, 1, 1))];
    const old = game(["d4", "d5"], "2024-01-31");
    const sameDay = game(["c4", "e5"], "2024-02-01");
    const ok = game(["e4", "e5", "Nf3"], "2024-02-10");
    const deeper = game(["e4", "e5", "Bc4", "Nf6"], "2024-03-01");
    const newest = game(["d4", "d5"], "2024-03-05");
    const { deviations } = analyzeRepertoire(newestFirst([old, sameDay, ok, deeper, newest]), { side: "white", maxMove: 3, locked });
    expect(deviations.map((d) => [d.game.game_id, d.expected, d.played, d.line])).toEqual([
      [newest.game_id, "e4", "d4", []],
      [deeper.game_id, "Nf3", "Bc4", ["e4", "e5"]],
      [sameDay.game_id, "e4", "c4", []],
    ]);
    expect(deviations[1].epd).toBe(epdAfter(["e4", "e5"]));
    expect(deviations[0].game).toMatchObject({ date: "2024-03-05", color: "white", moves: ["d4", "d5"], url: newest.url, source: "json" });
  });

  it("reports only the first deviation of a game", () => {
    // 1.Nf3 Nf6 2.c4 leaves both locked moves (start: e4; after 1.Nf3 Nf6: g3)
    const locked = [lock("white", [], "e4", 0), lock("white", ["Nf3", "Nf6"], "g3", 0)];
    const { deviations } = analyzeRepertoire([game(["Nf3", "Nf6", "c4"], day(1))], { side: "white", maxMove: 3, locked });
    expect(deviations).toHaveLength(1);
    expect(deviations[0]).toMatchObject({ expected: "e4", played: "Nf3" });
  });

  it("stops a game at an illegal stored move", () => {
    const gs = newestFirst([
      game(["e4", "e5", "Nf3", "Nc6"], day(1)),
      game(["e4", "e5", "Nf3", "Nc6"], day(2)),
      game(["e4", "e5", "Nf3", "Nc6"], day(3)),
      game(["e4", "e5", "Ke3", "Nc6", "Nf3"], day(4)),
    ]);
    const pts = analyzeRepertoire(gs, { side: "white", maxMove: 3, locked: [] }).points;
    expect(pts.find((p) => p.epd === START_EPD)!.games).toBe(4);
    const after = pts.find((p) => p.epd === epdAfter(["e4", "e5"]))!;
    expect(after.games).toBe(3);
    expect(after.moves.map((m) => m.san)).toEqual(["Nf3"]);
  });

  it("uses chess.js SAN and merges different spellings of one move", () => {
    const gs = newestFirst([game(["e4", "e5", "Nf3"], day(1)), game(["e4", "e5", "Ng1f3"], day(2)), game(["e4", "e5", "Nf3!?"], day(3))]);
    const p = analyzeRepertoire(gs, { side: "white", maxMove: 2, locked: [] }).points.find((x) => x.epd === epdAfter(["e4", "e5"]))!;
    expect(p.moves.map((m) => [m.san, m.games])).toEqual([["Nf3", 3]]);
  });
});

describe("play", () => {
  const cases: Array<[string, string]> = [
    [START_FEN, "e4"],
    [START_FEN, "Nf3"],
    [START_FEN, "g1f3"],
    [START_FEN, "Ng1f3"],
    ["r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", "O-O"],
    ["r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", "0-0"],
    ["rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3", "exf6"],
    ["rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3", "ef6"],
    ["8/4P3/8/8/8/8/k7/4K3 w - - 0 1", "e8=Q"],
    ["8/4P3/8/8/8/8/k7/4K3 w - - 0 1", "e8N"],
    ["rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", "Qh4"],
    ["rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", "Qh4#"],
    ["r3k3/8/8/8/8/8/8/R3K2R w KQq - 0 1", "Rd1"],
    ["r3k3/8/8/8/8/8/8/R3K2R w KQq - 0 1", "Rad1"],
    ["4k3/8/8/1N3N2/8/8/8/4K3 w - - 0 1", "Nbd4"],
    ["4k3/8/8/1N3N2/8/8/8/4K3 w - - 0 1", "Nfd6+"],
  ];
  it.each(cases)("matches chess.js move() in %s for %s", (fen, san) => {
    const ref = new Chess(fen).move(san);
    const got = play(new Chess(fen), san);
    expect(got).toEqual({ san: ref.san, fen: ref.after });
  });

  it("returns null for illegal, ambiguous and null moves", () => {
    expect(play(new Chess(), "Ke2")).toBeNull();
    expect(play(new Chess(), "Qh9")).toBeNull();
    expect(play(new Chess(), "--")).toBeNull();
    expect(play(new Chess("r3k3/8/8/8/8/8/8/R3K2R w KQq - 0 1"), "Rhd1")).toBeNull(); // the king is in the way
    expect(play(new Chess("4k3/8/8/1N3N2/8/8/8/4K3 w - - 0 1"), "Nd4")).toBeNull();
  });
});
