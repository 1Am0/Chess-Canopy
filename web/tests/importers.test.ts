import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { timeControlLabel } from "@/lib/importers/timeControl";
import { extractSanMoves, parsePgnHeaders } from "@/lib/importers/san";
import { fetchChessComGames, parseChessComGame, type ChessComRawGame } from "@/lib/importers/chesscom";
import { fetchLichessGames, parseLichessGame, type LichessRawGame } from "@/lib/importers/lichess";
import { parsePgnText } from "@/lib/importers/pgn";
import { parseStoreJson } from "@/lib/importers/normalize";

const rd = (p: string) => readFileSync(`tests/fixtures/${p}`, "utf8");

describe("timeControlLabel", () => {
  for (const c of JSON.parse(rd("golden/time_control_golden.json")) as Array<{ input: string; output: string }>) {
    it(`"${c.input}" -> ${c.output}`, () => expect(timeControlLabel(c.input)).toBe(c.output));
  }
  it("handles null", () => expect(timeControlLabel(null)).toBe("rapid"));
});

describe("san", () => {
  it("strips clocks, numbers, results", () => {
    expect(extractSanMoves("1. e4 {[%clk 0:03:00]} 1... e5 {x} 2.Nf3 Nc6 1-0")).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });
  it("handles nested variations, comments with parens, ; comments, NAGs, annotations", () => {
    const pgn = `[Event "x"]\n[White "a"]\n\n1. e4! $1 (1. d4 (1. c4 {)} Nf6) d5) 1... e5?! ; rest (of line\n2. Nf3 {a (b} Nc6 *`;
    expect(extractSanMoves(pgn)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });
  it("normalizes zero castling and keeps checks/promotions", () => {
    expect(extractSanMoves("1. e4 e5 2. 0-0 0-0-0+ 3. exd8=Q# 1/2-1/2")).toEqual(["e4", "e5", "O-O", "O-O-O+", "exd8=Q#"]);
  });
  it("empty and result-only", () => {
    expect(extractSanMoves("")).toEqual([]);
    expect(extractSanMoves("*")).toEqual([]);
  });
  it("parses headers with escapes", () => {
    expect(parsePgnHeaders('[Event "a \\"b\\""]\n[White "W"]\n\n1. e4 *')).toEqual({ Event: 'a "b"', White: "W" });
  });
});

describe("chess.com parse", () => {
  const raw = JSON.parse(rd("api/chesscom_game.json")) as ChessComRawGame;
  it("white perspective", () => {
    const g = parseChessComGame(raw, "hero")!;
    expect(g).toMatchObject({
      game_id: "123456", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"], result: "1-0", color: "white", date: "2024-03-05",
      opponent: "Villain", my_rating: 1500, opponent_rating: 1480, time_control: "blitz", time_control_raw: "180+2",
      termination: "Hero won by checkmate", url: "https://www.chess.com/game/live/123456", source: "chess.com", playerId: "chess.com:hero",
    });
  });
  it("black perspective flips result", () => {
    const g = parseChessComGame(raw, "VILLAIN")!;
    expect(g.color).toBe("black");
    expect(g.result).toBe("0-1");
    expect(g.opponent).toBe("Hero");
    expect(g.my_rating).toBe(1480);
  });
  it("draw and black win", () => {
    const d = { ...raw, white: { ...raw.white, result: "agreed" }, black: { ...raw.black, result: "agreed" } };
    expect(parseChessComGame(d, "hero")!.result).toBe("1/2-1/2");
    const b = { ...raw, white: { ...raw.white, result: "checkmated" }, black: { ...raw.black, result: "win" } };
    expect(parseChessComGame(b, "hero")!.result).toBe("0-1");
    expect(parseChessComGame(b, "villain")!.result).toBe("1-0");
  });
  it("skips variants and missing pgn", () => {
    expect(parseChessComGame({ ...raw, rules: "chess960" }, "hero")).toBeNull();
    expect(parseChessComGame({ ...raw, pgn: "" }, "hero")).toBeNull();
  });
});

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("chess.com fetch", () => {
  const archives = ["https://api.chess.com/pub/player/hero/games/2024/01", "https://api.chess.com/pub/player/hero/games/2024/02", "https://api.chess.com/pub/player/hero/games/2024/03"];
  const noSleep = async () => {};
  it("fetches newest first, honours sinceMonth, reports progress", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (u: string | URL | Request) => {
      const url = String(u);
      calls.push(url);
      if (url.endsWith("/archives")) return jsonRes({ archives });
      const m = url.slice(-2);
      return jsonRes({ games: [{ url: `g${m}a` }, { url: `g${m}b` }] });
    }) as unknown as typeof fetch;
    const prog: number[] = [];
    const r = await fetchChessComGames("Hero", { fetchImpl, sinceMonth: "2024/02", onProgress: (p) => prog.push(p.done), sleepImpl: noSleep });
    expect(r.games.map((g) => g.url)).toEqual(["g03b", "g03a", "g02b", "g02a"]);
    expect(r.lastMonth).toBe("2024/03");
    expect(prog).toEqual([1, 2]);
    expect(calls.some((c) => c.endsWith("2024/01"))).toBe(false);
  });
  it("retries 429/5xx with backoff then succeeds", async () => {
    let n = 0;
    const delays: number[] = [];
    const fetchImpl = (async (u: string | URL | Request) => {
      if (String(u).endsWith("/archives")) return jsonRes({ archives: [archives[0]] });
      return ++n < 3 ? jsonRes({}, n === 1 ? 429 : 503) : jsonRes({ games: [{ url: "ok" }] });
    }) as unknown as typeof fetch;
    const r = await fetchChessComGames("hero", { fetchImpl, sleepImpl: async (ms) => void delays.push(ms), baseDelayMs: 100 });
    expect(r.games).toHaveLength(1);
    expect(delays).toEqual([100, 200]);
  });
  it("gives up after 4 tries; 404 fails immediately", async () => {
    let n = 0;
    const f500 = (async () => (n++, jsonRes({}, 500))) as unknown as typeof fetch;
    await expect(fetchChessComGames("hero", { fetchImpl: f500, sleepImpl: noSleep })).rejects.toThrow(/500/);
    expect(n).toBe(4);
    n = 0;
    const f404 = (async () => (n++, jsonRes({}, 404))) as unknown as typeof fetch;
    await expect(fetchChessComGames("hero", { fetchImpl: f404, sleepImpl: noSleep })).rejects.toThrow(/404/);
    expect(n).toBe(1);
  });
  it("aborts", async () => {
    const ac = new AbortController();
    ac.abort();
    const fetchImpl = (async () => jsonRes({ archives })) as unknown as typeof fetch;
    await expect(fetchChessComGames("hero", { fetchImpl, signal: ac.signal })).rejects.toMatchObject({ name: "AbortError" });
  });
  it("limits concurrency to 4", async () => {
    const many = Array.from({ length: 10 }, (_, i) => `https://api.chess.com/pub/player/h/games/2024/${String(i + 1).padStart(2, "0")}`);
    let active = 0;
    let max = 0;
    const fetchImpl = (async (u: string | URL | Request) => {
      if (String(u).endsWith("/archives")) return jsonRes({ archives: many });
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return jsonRes({ games: [] });
    }) as unknown as typeof fetch;
    await fetchChessComGames("h", { fetchImpl });
    expect(max).toBe(4);
  });
});

describe("lichess", () => {
  const raw = JSON.parse(rd("api/lichess_game.json")) as LichessRawGame;
  it("parses black perspective", () => {
    expect(parseLichessGame(raw, "Hero")).toMatchObject({
      game_id: "abcd1234", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"], result: "1-0", color: "black", date: "2024-03-05",
      opponent: "Villain", my_rating: 1750, opponent_rating: 1800, time_control: "bullet", time_control_raw: "15+0",
      url: "https://lichess.org/abcd1234", source: "lichess", playerId: "lichess:hero", termination: "Normal",
    });
  });
  it("white loss, draw, correspondence, variant", () => {
    expect(parseLichessGame(raw, "villain")!.result).toBe("0-1");
    const d = { ...raw, winner: undefined, status: "draw", speed: "correspondence", clock: undefined, daysPerTurn: 2 };
    const g = parseLichessGame(d, "hero")!;
    expect(g.result).toBe("1/2-1/2");
    expect(g.time_control).toBe("daily");
    expect(g.time_control_raw).toBe("1/172800");
    expect(parseLichessGame({ ...raw, variant: "chess960" }, "hero")).toBeNull();
    expect(parseLichessGame({ ...raw, moves: "" }, "hero")!.moves).toEqual([]);
  });
  it("streams NDJSON across chunk boundaries, with abort", async () => {
    const text = JSON.stringify(raw) + "\n\n" + JSON.stringify({ ...raw, id: "zzzz" });
    const bytes = new TextEncoder().encode(text);
    const mkBody = () =>
      new ReadableStream<Uint8Array>({
        start(c) {
          for (let i = 0; i < bytes.length; i += 37) c.enqueue(bytes.slice(i, i + 37));
          c.close();
        },
      });
    let seen: { url: string; init?: RequestInit } | undefined;
    const fetchImpl = (async (u: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(u), init };
      return new Response(mkBody());
    }) as unknown as typeof fetch;
    const counts: number[] = [];
    const ids: string[] = [];
    for await (const g of fetchLichessGames("Hero", { fetchImpl, since: 5, onProgress: (n) => counts.push(n) })) ids.push(g.id!);
    expect(ids).toEqual(["abcd1234", "zzzz"]);
    expect(counts).toEqual([1, 2]);
    expect(seen!.url).toContain("since=5");
    expect((seen!.init!.headers as Record<string, string>).Accept).toBe("application/x-ndjson");
    const ac = new AbortController();
    ac.abort();
    const it = fetchLichessGames("Hero", { fetchImpl, signal: ac.signal });
    await expect(it.next()).rejects.toMatchObject({ name: "AbortError" });
  });
  it("throws on http error", async () => {
    const fetchImpl = (async () => new Response("", { status: 429 })) as unknown as typeof fetch;
    await expect(fetchLichessGames("x", { fetchImpl }).next()).rejects.toThrow(/429/);
  });
});

describe("pgn", () => {
  const golden = JSON.parse(rd("golden/pgn_golden.json"));
  it("matches python import output", () => {
    const games = parsePgnText(rd("golden/sample.pgn"), "Hero");
    expect(games.map((x) => { const g: Record<string, unknown> = { ...x }; delete g.source; delete g.playerId; return g; })).toEqual(golden);
    expect(games[0].source).toBe("pgn");
  });
  it("handles multiple games without blank separators and missing Site", () => {
    const t = `[White "me"]\n[Black "x"]\n[Result "*"]\n\n1. e4 e5 *\n[White "y"]\n[Black "ME"]\n[Result "1-0"]\n\n1. d4 d5 1-0\n`;
    const g = parsePgnText(t, "me");
    expect(g.map((x) => x.game_id)).toEqual(["pgn-1", "pgn-2"]);
    expect(g[1]).toMatchObject({ color: "black", result: "0-1", moves: ["d4", "d5"] });
    expect(g[0].result).toBe("*");
  });
});

describe("normalize", () => {
  const opts = { source: "json" as const, playerId: "json:me" };
  const sample = rd("golden/sample_games.json");
  it("parses v1 store", () => {
    const g = parseStoreJson(sample, opts);
    expect(g).toHaveLength(3);
    expect(g[0]).toMatchObject({ source: "json", playerId: "json:me", game_id: "sample-1", my_rating: 1500 });
  });
  it("parses bare array and coerces ratings", () => {
    const arr = JSON.stringify([{ game_id: 1, moves: ["e4"], color: "white", my_rating: "1600", opponent_rating: null }, { moves: "bad", color: "white" }, { moves: [], color: "green" }, 5]);
    const g = parseStoreJson(arr, opts);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ game_id: "1", my_rating: 1600, opponent_rating: null });
  });
  it("rejects garbage", () => {
    expect(() => parseStoreJson("{}", opts)).toThrow();
    expect(() => parseStoreJson("nope", opts)).toThrow();
  });
});
