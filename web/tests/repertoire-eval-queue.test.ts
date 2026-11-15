import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import type { CloudEval, EvalResult } from "@/lib/cloud-eval";
import { createEvalQueue, type EvalQueueDeps } from "@/lib/repertoire/eval-queue";
import { getCachedEvals, normFen, putCachedEval } from "@/lib/repertoire/eval-cache";
import type { DecisionPoint, MoveUsage, PointEval, RepertoireReport } from "@/lib/repertoire/types";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const cp = (n: number): CloudEval => ({ cp: n, mate: null, depth: 20 });

function after(fen: string, san: string) {
  const c = new Chess(fen);
  c.move(san);
  return c.fen();
}
function usage(fen: string, san: string, games: number): MoveUsage {
  return { san, games, wins: 0, draws: 0, losses: 0, firstDate: "", lastDate: "", fenAfter: after(fen, san) };
}
function point(epd: string, fen: string, moves: MoveUsage[]): DecisionPoint {
  const games = moves.reduce((s, m) => s + m.games, 0);
  return { epd, fen, line: [], moveNumber: 1, games, moves, main: moves[0].san, consistency: moves[0].games / games, switch: null, priority: 0, locked: null };
}
function report(points: DecisionPoint[]): RepertoireReport {
  return { side: "white", timeControl: null, maxMove: 12, periodDays: null, games: 10, points, deviations: [], timeControls: [] };
}

const P1 = point("p1", START, [usage(START, "e4", 10)]);
const AFTER_E4 = after(START, "e4");
const AFTER_D4 = after(START, "d4");

function fakeDeps(over: Partial<EvalQueueDeps> = {}) {
  const cloudCalls: string[] = [];
  const localCalls: string[] = [];
  const puts: string[] = [];
  const deps: EvalQueueDeps = {
    cloud: async (fen) => {
      cloudCalls.push(fen);
      return { status: "ok", eval: cp(fen === START ? 30 : 20) };
    },
    local: async (fen) => {
      localCalls.push(fen);
      return cp(0);
    },
    localAvailable: () => true,
    cache: { get: async () => new Map(), put: async (fen) => void puts.push(fen) },
    ...over,
  };
  return { deps, cloudCalls, localCalls, puts };
}

async function collect(deps: EvalQueueDeps, r: RepertoireReport, signal = new AbortController().signal) {
  const emits: PointEval[] = [];
  await createEvalQueue(deps).run(r, (pe) => emits.push(pe), signal);
  return emits;
}

describe("eval queue", () => {
  it("emits cache hits first without touching the network", async () => {
    const f = fakeDeps({
      cache: { get: async (fens) => new Map(fens.map((x) => [x, cp(x === normFen(START) ? 30 : 20)] as const)), put: async () => {} },
    });
    const emits = await collect(f.deps, report([P1]));
    expect(f.cloudCalls).toEqual([]);
    expect(emits).toHaveLength(1);
    expect(emits[0].moves.e4).toMatchObject({ lossCp: 10, verdict: "good" });
    expect(emits[0].status).toBe("settled");
  });

  it("evaluates one position at a time and emits partial results", async () => {
    const f = fakeDeps();
    const emits = await collect(f.deps, report([P1]));
    expect(f.cloudCalls).toEqual([START, AFTER_E4]);
    expect(emits.map((e) => e.status)).toEqual(["pending", "settled"]);
    expect(emits[0].moves.e4).toMatchObject({ after: null, verdict: "unknown" });
    expect(f.puts).toEqual([START, AFTER_E4]);
  });

  it("falls back to the local engine when the cloud has nothing", async () => {
    const f = fakeDeps({
      cloud: async (fen): Promise<EvalResult> => (fen === START ? { status: "ok", eval: cp(30) } : { status: "none" }),
      local: async () => cp(-200),
    });
    const emits = await collect(f.deps, report([P1]));
    const last = emits.at(-1)!;
    expect(last.moves.e4.after).toEqual({ ...cp(-200), source: "local" });
    expect(last.moves.e4.verdict).toBe("bad");
    expect(last.status).toBe("leaking");
  });

  it("leaves a position unknown when both cloud and local fail", async () => {
    const local = vi.fn(async () => null);
    const f = fakeDeps({ cloud: async () => ({ status: "error" }), local });
    const emits = await collect(f.deps, report([P1]));
    expect(local).toHaveBeenCalledTimes(2);
    expect(emits.at(-1)!.moves.e4.verdict).toBe("unknown");
    expect(emits.at(-1)!.status).toBe("pending");
    expect(f.puts).toEqual([]);
  });

  it("skips the local engine when it is unavailable", async () => {
    const f = fakeDeps({ cloud: async () => ({ status: "none" }), localAvailable: () => false });
    await collect(f.deps, report([P1]));
    expect(f.localCalls).toEqual([]);
  });

  it("evaluates a FEN shared by two points only once and re-emits both", async () => {
    // same position with different move counters: one key
    const P2 = point("p2", START.replace(/0 1$/, "4 9"), [usage(START, "e4", 6), usage(START, "d4", 4)]);
    const f = fakeDeps();
    const emits = await collect(f.deps, report([P1, P2]));
    expect(f.cloudCalls).toEqual([START, AFTER_E4, AFTER_D4]);
    expect(emits.filter((e) => e.epd === "p1")).toHaveLength(2);
    expect(emits.filter((e) => e.epd === "p2")).toHaveLength(3);
    expect(emits.at(-1)).toMatchObject({ epd: "p2", status: "undecided" });
  });

  it("stops after an abort", async () => {
    const ctl = new AbortController();
    const f = fakeDeps({
      cloud: async () => {
        ctl.abort();
        return { status: "ok", eval: cp(0) };
      },
    });
    const emits = await collect(f.deps, report([P1]), ctl.signal);
    expect(emits).toEqual([]);
    expect(f.puts).toEqual([]);
  });

  it("does not throw when the cache or the network throws", async () => {
    const f = fakeDeps({
      cache: { get: async () => Promise.reject(new Error("no idb")), put: async () => Promise.reject(new Error("quota")) },
      cloud: async () => Promise.reject(new Error("boom")),
      local: async () => cp(10),
    });
    const emits = await collect(f.deps, report([P1]));
    // both positions came from the local engine (cp 10 each)
    expect(emits.at(-1)!.moves.e4).toMatchObject({ lossCp: 0, verdict: "good" });
  });
});

describe("eval cache", () => {
  it("stores by normalised FEN and reads back", async () => {
    await putCachedEval(START.replace(/0 1$/, "3 7"), cp(42));
    const got = await getCachedEvals([START, AFTER_E4]);
    expect(got.get(START)).toEqual(cp(42));
    expect(got.has(AFTER_E4)).toBe(false);
  });
});
