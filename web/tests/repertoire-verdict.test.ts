import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import type { CloudEval } from "@/lib/cloud-eval";
import type { DecisionPoint, MoveEval, MoveUsage, PointEval } from "@/lib/repertoire/types";
import {
  evalToCp,
  lossCp,
  moveEval,
  movesToEvaluate,
  sortForDisplay,
  statusOf,
  verdictOf,
} from "@/lib/repertoire/verdict";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const cp = (n: number): CloudEval => ({ cp: n, mate: null, depth: 20 });
const mate = (n: number): CloudEval => ({ cp: null, mate: n, depth: 20 });

function fenAfter(fen: string, san: string) {
  const c = new Chess(fen);
  c.move(san);
  return c.fen();
}

function usage(san: string, games: number, fen = START): MoveUsage {
  return { san, games, wins: 0, draws: 0, losses: 0, firstDate: "2024-01-01", lastDate: "2024-02-01", fenAfter: fenAfter(fen, san) };
}

function point(over: Partial<DecisionPoint> & { moves: MoveUsage[] }): DecisionPoint {
  const games = over.games ?? over.moves.reduce((s, m) => s + m.games, 0);
  const main = over.main ?? over.moves[0].san;
  const consistency = over.consistency ?? (over.moves.find((m) => m.san === main)?.games ?? 0) / games;
  return {
    epd: over.epd ?? "start",
    fen: START,
    line: [],
    moveNumber: 1,
    switch: null,
    locked: null,
    priority: games * (1 - consistency),
    ...over,
    games,
    main,
    consistency,
  };
}

const me = (san: string, verdict: MoveEval["verdict"]): MoveEval => ({ san, after: null, lossCp: null, verdict });
const ev = (...ms: MoveEval[]) => ({ before: cp(0), moves: Object.fromEntries(ms.map((m) => [m.san, m])) });

describe("evalToCp", () => {
  it("clamps plain scores", () => {
    expect(evalToCp(cp(35))).toBe(35);
    expect(evalToCp(cp(5000))).toBe(1000);
    expect(evalToCp(cp(-5000))).toBe(-1000);
    expect(evalToCp({ cp: null, mate: null, depth: 1 })).toBe(0);
  });
  it("maps mates", () => {
    expect(evalToCp(mate(3))).toBe(9970);
    expect(evalToCp(mate(-2))).toBe(-9980);
    expect(evalToCp(mate(0))).toBe(0);
  });
});

describe("lossCp", () => {
  it("is from the mover's point of view and never negative", () => {
    expect(lossCp(cp(30), cp(-40), "white")).toBe(70);
    expect(lossCp(cp(30), cp(80), "white")).toBe(0);
    expect(lossCp(cp(-30), cp(40), "black")).toBe(70);
    expect(lossCp(cp(-30), cp(-90), "black")).toBe(0);
  });
  it("caps at 2000", () => {
    expect(lossCp(mate(2), mate(-2), "white")).toBe(2000);
    expect(lossCp(cp(0), mate(-5), "white")).toBe(2000);
    expect(lossCp(cp(0), mate(5), "black")).toBe(2000);
  });
});

describe("verdictOf", () => {
  it("applies the thresholds", () => {
    expect(verdictOf(null)).toBe("unknown");
    expect(verdictOf(0)).toBe("good");
    expect(verdictOf(49)).toBe("good");
    expect(verdictOf(50)).toBe("dubious");
    expect(verdictOf(99)).toBe("dubious");
    expect(verdictOf(100)).toBe("bad");
  });
  it("moveEval combines them", () => {
    expect(moveEval("e4", cp(20), cp(-60), "white")).toEqual({ san: "e4", after: cp(-60), lossCp: 80, verdict: "dubious" });
  });
});

describe("statusOf", () => {
  const consistent = point({ moves: [usage("e4", 9), usage("d4", 1)] }); // 0.9
  it("consistent points", () => {
    expect(statusOf(consistent, undefined)).toBe("pending");
    expect(statusOf(consistent, ev(me("e4", "good")))).toBe("settled");
    expect(statusOf(consistent, ev(me("e4", "dubious")))).toBe("leaking");
    expect(statusOf(consistent, ev(me("e4", "bad")))).toBe("leaking");
    expect(statusOf(consistent, ev(me("e4", "unknown"), me("d4", "bad")))).toBe("pending");
  });
  const mixed = point({ moves: [usage("e4", 6), usage("d4", 3), usage("c4", 1)] }); // c4 10%
  it("inconsistent points", () => {
    expect(statusOf(mixed, undefined)).toBe("pending");
    expect(statusOf(mixed, ev(me("e4", "good"), me("d4", "bad")))).toBe("problem");
    expect(statusOf(mixed, ev(me("e4", "dubious"), me("d4", "unknown")))).toBe("problem");
    expect(statusOf(mixed, ev(me("e4", "good"), me("d4", "good"), me("c4", "bad")))).toBe("undecided");
    expect(statusOf(mixed, ev(me("e4", "good"), me("d4", "unknown")))).toBe("pending");
  });
  it("sends a move played once to the engine too, and waits for its verdict", () => {
    const p = point({ moves: [usage("e4", 2), usage("d4", 1)] }); // d4: 1 game, 33%
    expect(movesToEvaluate(p).map((m) => m.san)).toEqual(["e4", "d4"]);
    expect(statusOf(p, ev(me("e4", "good")))).toBe("pending");
    expect(statusOf(p, ev(me("e4", "good"), me("d4", "good")))).toBe("undecided");
    expect(statusOf(p, ev(me("e4", "good"), me("d4", "bad")))).toBe("problem");
  });
  it("needs the main move's verdict before calling a point undecided", () => {
    const p = point({ moves: [usage("e4", 5), usage("d4", 4), usage("c4", 1)], main: "c4", locked: "c4" });
    expect(statusOf(p, ev(me("e4", "good"), me("d4", "good")))).toBe("pending");
    expect(statusOf(p, ev(me("e4", "good"), me("d4", "good"), me("c4", "good")))).toBe("undecided");
  });
});

describe("movesToEvaluate", () => {
  it("takes every move played, and a locked move never played", () => {
    const p = point({
      moves: [usage("e4", 5), usage("d4", 2), usage("c4", 1), usage("g3", 1)],
      main: "g3",
      locked: "Nf3",
    });
    const ms = movesToEvaluate(p);
    expect(ms.map((m) => m.san).sort()).toEqual(["Nf3", "c4", "d4", "e4", "g3"]);
    const nf3 = ms.find((m) => m.san === "Nf3")!;
    expect(nf3.games).toBe(0);
    expect(nf3.fenAfter).toBe(fenAfter(START, "Nf3"));
  });
  it("does not duplicate a locked move that was played", () => {
    const p = point({ moves: [usage("e4", 5), usage("d4", 2)], main: "d4", locked: "d4" });
    expect(movesToEvaluate(p).map((m) => m.san)).toEqual(["e4", "d4"]);
  });
});

describe("sortForDisplay", () => {
  it("orders by status, then priority, then games", () => {
    const mk = (epd: string, priority: number, games: number) => ({ ...point({ epd, moves: [usage("e4", 9), usage("d4", 1)] }), priority, games });
    const pts = [mk("settled", 9, 9), mk("pendA", 1, 3), mk("pendB", 1, 8), mk("problem", 0, 1), mk("pendC", 5, 1), mk("leak", 0, 1)];
    const st = (epd: string, status: PointEval["status"]): [string, PointEval] => [epd, { epd, before: null, moves: {}, status }];
    const evals = new Map([st("settled", "settled"), st("problem", "problem"), st("leak", "leaking")]);
    expect(sortForDisplay(pts, evals).map((p) => p.epd)).toEqual(["problem", "leak", "pendC", "pendB", "pendA", "settled"]);
  });
});
