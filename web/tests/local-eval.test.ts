import { beforeEach, describe, expect, it, vi } from "vitest";
import { __setEngineFactory, evalLocal, parseInfoScore, type EngineFactory } from "@/lib/local-eval";

const WHITE_TO_MOVE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const BLACK_TO_MOVE = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("parseInfoScore", () => {
  it("reads centipawns and keeps them from White's point of view", () => {
    const line = "info depth 12 seldepth 16 multipv 1 score cp 34 nodes 1000 pv e2e4";
    expect(parseInfoScore(line, true)).toEqual({ cp: 34, mate: null, depth: 12 });
    expect(parseInfoScore(line, false)).toEqual({ cp: -34, mate: null, depth: 12 });
  });
  it("converts mate scores the same way", () => {
    expect(parseInfoScore("info depth 9 score mate 3 pv a", true)).toEqual({ cp: null, mate: 3, depth: 9 });
    expect(parseInfoScore("info depth 9 score mate 3 pv a", false)).toEqual({ cp: null, mate: -3, depth: 9 });
  });
  it("shows being checkmated as a decisive score for the other side", () => {
    expect(parseInfoScore("info depth 0 score mate 0", true)?.cp).toBe(-1000);
    expect(parseInfoScore("info depth 0 score mate 0", false)?.cp).toBe(1000);
  });
  it("ignores bounds, non-score lines and garbage", () => {
    expect(parseInfoScore("info depth 5 score cp 10 lowerbound", true)).toBeNull();
    expect(parseInfoScore("info string NNUE evaluation using nn.bin", true)).toBeNull();
    expect(parseInfoScore("bestmove e2e4", true)).toBeNull();
  });
});

/** A fake engine that answers each `go` with one info line (score given by `scoreFor`) and a bestmove. */
function fakeEngine(scoreFor: (fen: string) => string, opts: { holdSearch?: boolean } = {}) {
  const log: string[] = [];
  let lineSink: (l: string) => void = () => {};
  let fen = "";
  const factory: EngineFactory = (onLine) => {
    lineSink = onLine;
    return {
      post(cmd) {
        log.push(cmd);
        if (cmd === "uci") queueMicrotask(() => onLine("uciok"));
        else if (cmd === "isready") queueMicrotask(() => onLine("readyok"));
        else if (cmd.startsWith("position fen ")) fen = cmd.slice("position fen ".length);
        else if (cmd.startsWith("go ") && !opts.holdSearch) {
          queueMicrotask(() => {
            onLine(`info depth 14 score ${scoreFor(fen)} pv e2e4`);
            onLine("bestmove e2e4");
          });
        } else if (cmd === "stop") queueMicrotask(() => onLine("bestmove e2e4"));
      },
      terminate() {},
    };
  };
  return { factory, log, emit: (l: string) => lineSink(l) };
}

describe("evalLocal", () => {
  beforeEach(() => __setEngineFactory(null));

  it("returns the final score in White's terms and caches it", async () => {
    const eng = fakeEngine(() => "cp 25");
    __setEngineFactory(eng.factory);
    expect(await evalLocal(WHITE_TO_MOVE)).toEqual({ cp: 25, mate: null, depth: 14 });
    expect(await evalLocal(BLACK_TO_MOVE)).toEqual({ cp: -25, mate: null, depth: 14 });
    const goes = eng.log.filter((c) => c.startsWith("go ")).length;
    expect(await evalLocal(WHITE_TO_MOVE)).toEqual({ cp: 25, mate: null, depth: 14 });
    expect(eng.log.filter((c) => c.startsWith("go ")).length).toBe(goes);
  });

  it("limits the search by depth and time", async () => {
    const eng = fakeEngine(() => "cp 0");
    __setEngineFactory(eng.factory);
    await evalLocal(WHITE_TO_MOVE, { depth: 10, movetime: 500 });
    expect(eng.log).toContain("go depth 10 movetime 500");
  });

  it("reports progress while searching", async () => {
    const eng = fakeEngine(() => "cp 5", { holdSearch: true });
    __setEngineFactory(eng.factory);
    const seen: number[] = [];
    const p = evalLocal(WHITE_TO_MOVE, { onProgress: (e) => seen.push(e.depth) });
    await new Promise((r) => setTimeout(r, 0));
    eng.emit("info depth 3 score cp 1 pv a");
    eng.emit("info depth 8 score cp 2 pv a");
    eng.emit("info depth 12 score cp 3 pv a");
    eng.emit("bestmove e2e4");
    expect(await p).toEqual({ cp: 3, mate: null, depth: 12 });
    expect(seen).toEqual([8, 12]); // depth 3 is too shallow to show
  });

  it("aborting stops the search and resolves null", async () => {
    const eng = fakeEngine(() => "cp 5", { holdSearch: true });
    __setEngineFactory(eng.factory);
    const ctl = new AbortController();
    const p = evalLocal(WHITE_TO_MOVE, { signal: ctl.signal });
    await new Promise((r) => setTimeout(r, 0));
    ctl.abort();
    expect(await p).toBeNull();
    expect(eng.log).toContain("stop");
  });

  it("only the newest queued request is searched", async () => {
    const eng = fakeEngine(() => "cp 7");
    __setEngineFactory(eng.factory);
    const a = evalLocal(WHITE_TO_MOVE);
    const b = evalLocal("8/8/8/8/8/8/8/K1k5 w - - 0 1");
    const c = evalLocal(BLACK_TO_MOVE);
    const [ra, rb, rc] = await Promise.all([a, b, c]);
    expect(rb).toBeNull();
    expect(rc).toEqual({ cp: -7, mate: null, depth: 14 });
    expect(ra === null || ra.depth === 14).toBe(true);
  });

  it("resolves null, and stays out of the way, when the engine cannot start", async () => {
    __setEngineFactory(() => {
      throw new Error("no worker");
    });
    expect(await evalLocal(WHITE_TO_MOVE)).toBeNull();
    expect(await evalLocal(BLACK_TO_MOVE)).toBeNull();
  });

  it("continuous mode searches without a limit, keeps reporting, and ends when stopped", async () => {
    const eng = fakeEngine(() => "cp 0", { holdSearch: true });
    __setEngineFactory(eng.factory);
    const seen: number[] = [];
    const ctl = new AbortController();
    const p = evalLocal(WHITE_TO_MOVE, { continuous: true, signal: ctl.signal, onProgress: (e) => seen.push(e.depth) });
    await vi.waitFor(() => expect(eng.log).toContain("go infinite"));
    eng.emit("info depth 14 score cp 5 pv a");
    eng.emit("info depth 22 score cp 7 pv a");
    eng.emit("info depth 31 score cp 9 pv a");
    expect(seen).toEqual([14, 22, 31]); // goes past the old depth-14 limit
    expect(eng.log.some((c) => c.startsWith("go depth"))).toBe(false);
    ctl.abort();
    expect(await p).toEqual({ cp: 9, mate: null, depth: 31 });
    // not cached: asking again searches again
    const again = evalLocal(WHITE_TO_MOVE, { continuous: true });
    await vi.waitFor(() => expect(eng.log.filter((c) => c === "go infinite").length).toBe(2));
    void again;
  });
});
