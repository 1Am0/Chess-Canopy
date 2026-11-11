import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { lichessSpeedLabel, lichessTimeControlLabel, normalizeLichessRaw, timeControlLabel } from "@/lib/importers/timeControl";
import { extractSanMoves, parsePgnHeaders } from "@/lib/importers/san";
import { fetchChessComGames, parseChessComGame, type ChessComRawGame } from "@/lib/importers/chesscom";
import { fetchLichessGames, isOngoing, parseLichessGame, type LichessRawGame } from "@/lib/importers/lichess";
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
  it("fetches newest first, honors sinceMonth, reports progress", async () => {
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
  it("gives up after 5 tries; 404 fails immediately", async () => {
    let n = 0;
    const f500 = (async () => (n++, jsonRes({}, 500))) as unknown as typeof fetch;
    await expect(fetchChessComGames("hero", { fetchImpl: f500, sleepImpl: noSleep })).rejects.toThrow(/500/);
    expect(n).toBe(5);
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
  it("limits concurrency to 2", async () => {
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
    expect(max).toBe(2);
  });
  it("does not retry 403 and surfaces the reason", async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n++;
      return new Response("Blocked: Archive crawl was too heavy for this API.", { status: 403 });
    }) as unknown as typeof fetch;
    const err = await fetchChessComGames("hero", { fetchImpl, sleepImpl: noSleep }).catch((e) => e);
    expect(n).toBe(1);
    expect(err).toMatchObject({ status: 403, body: "Blocked: Archive crawl was too heavy for this API." });
  });
  it("honors Retry-After and caps the backoff", async () => {
    let n = 0;
    const delays: number[] = [];
    const fetchImpl = (async (u: string | URL | Request) => {
      if (String(u).endsWith("/archives")) return jsonRes({ archives: [archives[0]] });
      return ++n < 3 ? new Response("{}", { status: 429, headers: { "retry-after": "7" } }) : jsonRes({ games: [] });
    }) as unknown as typeof fetch;
    await fetchChessComGames("hero", { fetchImpl, sleepImpl: async (ms) => void delays.push(ms), baseDelayMs: 100 });
    expect(delays).toEqual([7000, 7000]);
  });
  it("the first failing archive cancels its siblings", async () => {
    const many = Array.from({ length: 6 }, (_, i) => `https://api.chess.com/pub/player/h/games/2024/${String(i + 1).padStart(2, "0")}`);
    const started: string[] = [];
    const fetchImpl = (async (u: string | URL | Request, init?: RequestInit) => {
      const url = String(u);
      if (url.endsWith("/archives")) return jsonRes({ archives: many });
      started.push(url);
      if (url.endsWith("/06")) return jsonRes({}, 404);
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 50);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
      return jsonRes({ games: [] });
    }) as unknown as typeof fetch;
    await expect(fetchChessComGames("h", { fetchImpl, sleepImpl: noSleep })).rejects.toMatchObject({ status: 404 });
    // newest first: 06 fails at once, 05 is aborted, nothing after that starts
    expect(started).toEqual([many[5], many[4]]);
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
    expect(g).toHaveLength(2);
    for (const x of g) expect(x.game_id).toMatch(/^pgn-[0-9a-f]{16}$/);
    expect(g[0].game_id).not.toBe(g[1].game_id);
    // stable: the same text gives the same ids
    expect(parsePgnText(t, "me").map((x) => x.game_id)).toEqual(g.map((x) => x.game_id));
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

describe("time-control rule", () => {
  it("daily for '/', '-' and 'day' formats", () => {
    expect(timeControlLabel("1/86400")).toBe("daily");
    expect(timeControlLabel("-")).toBe("daily");
    expect(timeControlLabel("1 day per move")).toBe("daily");
    expect(timeControlLabel("3 days per move")).toBe("daily");
  });
  it("Lichess thresholds and speed", () => {
    expect(lichessTimeControlLabel("480+0")).toBe("rapid"); // chess.com rule: blitz
    expect(lichessTimeControlLabel("300+3")).toBe("blitz");
    expect(lichessTimeControlLabel("300+5")).toBe("rapid"); // 500 >= 480
    expect(lichessTimeControlLabel("900+15")).toBe("classical"); // 1500
    expect(lichessTimeControlLabel("600+0")).toBe("rapid");
    expect(lichessTimeControlLabel("60+0")).toBe("bullet");
    expect(lichessTimeControlLabel("-")).toBe("daily");
    expect(lichessTimeControlLabel("")).toBe("daily");
    expect(lichessSpeedLabel("Rated Blitz game")).toBe("blitz");
    expect(lichessSpeedLabel("ultraBullet")).toBe("bullet");
    expect(lichessSpeedLabel("correspondence")).toBe("daily");
    expect(lichessSpeedLabel("Casual game")).toBeNull();
    expect(normalizeLichessRaw("2 days per move")).toBe("1/172800");
    expect(normalizeLichessRaw("300+0")).toBe("300+0");
  });
  it("Lichess importer falls back to thresholds without speed; unlimited correspondence is '-'", () => {
    const raw = JSON.parse(rd("api/lichess_game.json")) as LichessRawGame;
    const g = parseLichessGame({ ...raw, speed: undefined, clock: { initial: 480, increment: 0 } }, "hero")!;
    expect(g.time_control).toBe("rapid");
    const c = parseLichessGame({ ...raw, speed: "correspondence", clock: undefined }, "hero")!;
    expect(c).toMatchObject({ time_control: "daily", time_control_raw: "-" });
  });
});

describe("san normalisation", () => {
  it("lower-case and zero castling, promotions without '=', glued e.p.", () => {
    expect(extractSanMoves("1. e4 e5 2. o-o o-o-o+ 3. 0-0")).toEqual(["e4", "e5", "O-O", "O-O-O+", "O-O"]);
    expect(extractSanMoves("1. e8Q exd1q+ e8=n")).toEqual(["e8=Q", "exd1=Q+", "e8=N"]);
    expect(extractSanMoves("1. e4 d5 2. e5 f5 3. exf6e.p. Nxf6 4. d4 e.p. Nc6")).toEqual(["e4", "d5", "e5", "f5", "exf6", "Nxf6", "d4", "Nc6"]);
  });
});

describe("pgn ids, variants, elo and dates", () => {
  const game = (h: Record<string, string>, moves = "1. e4 e5 2. Nf3 Nc6") =>
    Object.entries(h).map(([k, v]) => `[${k} "${v}"]`).join("\n") + `\n\n${moves} ${h.Result ?? "*"}\n\n`;
  it("Site 'Chess.com' without Link keeps every game; OTB Site too", () => {
    const t =
      game({ Event: "Live Chess", Site: "Chess.com", White: "me", Black: "a", Result: "1-0" }) +
      game({ Event: "Live Chess", Site: "Chess.com", White: "b", Black: "me", Result: "0-1" }) +
      game({ Event: "Club", Site: "London ENG", White: "me", Black: "c", Result: "1/2-1/2" }) +
      game({ Event: "Club", Site: "London ENG", White: "me", Black: "d", Result: "1/2-1/2" });
    const g = parsePgnText(t, "me");
    expect(g).toHaveLength(4);
    expect(new Set(g.map((x) => x.game_id)).size).toBe(4);
    for (const x of g) expect(x.url).toBe("");
  });
  it("uses the URL path for ids (Link before Site), never a bare host", () => {
    const t =
      game({ Site: "Chess.com", Link: "https://www.chess.com/game/live/98765", White: "me", Black: "a", Result: "1-0" }) +
      game({ Site: "https://lichess.org/AbCd1234", White: "me", Black: "b", Result: "1-0" }) +
      game({ Site: "https://lichess.org/", White: "me", Black: "c", Result: "1-0" });
    const g = parsePgnText(t, "me");
    expect(g.map((x) => x.game_id).slice(0, 2)).toEqual(["98765", "AbCd1234"]);
    expect(g[0].url).toBe("https://www.chess.com/game/live/98765");
    expect(g[2].game_id).toMatch(/^pgn-/);
  });
  it("identical games are deduped in-file", () => {
    const one = game({ Site: "Chess.com", White: "me", Black: "a", Result: "1-0", Date: "2024.01.02" });
    expect(parsePgnText(one + one, "me")).toHaveLength(1);
  });
  it("skips SetUp/FEN/Variant and illegal games and counts them", () => {
    const stats = { skipped: 0 };
    const t =
      game({ White: "me", Black: "a", Result: "1-0", SetUp: "1", FEN: "8/8/8/8/8/8/8/K6k w - - 0 1" }, "1. Kb1 Kg1") +
      game({ White: "me", Black: "a", Result: "1-0", Variant: "Chess960" }) +
      game({ White: "me", Black: "a", Result: "1-0", Variant: "Crazyhouse" }, "1. e4 d5 2. exd5 Qxd5 3. P@e4") +
      game({ White: "me", Black: "a", Result: "1-0" }, "1. e4 Nge7") +
      game({ White: "me", Black: "a", Result: "1-0", Termination: "me won by the king reaching the hill" }) +
      game({ White: "me", Black: "a", Result: "1-0", Variant: "Standard", Date: "2024.01.03" });
    const g = parsePgnText(t, "me", stats);
    expect(g).toHaveLength(1);
    expect(stats.skipped).toBe(5);
  });
  it("'?' or missing Elo is null, missing or invalid date is ''", () => {
    const t =
      game({ White: "me", Black: "a", Result: "1-0", WhiteElo: "?", BlackElo: "1500", Date: "????.??.??" }) +
      game({ White: "b", Black: "me", Result: "0-1", Date: "2024.02.03" });
    const [a, b] = parsePgnText(t, "me");
    expect(a).toMatchObject({ my_rating: null, opponent_rating: 1500, date: "" });
    expect(b).toMatchObject({ my_rating: null, opponent_rating: null, date: "2024-02-03" });
  });
  it("Lichess PGNs use the Lichess speed", () => {
    const t = game({ Site: "https://lichess.org/xyz12345", Event: "Rated Rapid game", White: "me", Black: "a", Result: "1-0", TimeControl: "480+0" });
    expect(parsePgnText(t, "me")[0]).toMatchObject({ time_control: "rapid", time_control_raw: "480+0" });
    const u = game({ Site: "https://lichess.org/xyz12346", Event: "Casual game", White: "me", Black: "a", Result: "1-0", TimeControl: "900+15" });
    expect(parsePgnText(u, "me")[0].time_control).toBe("classical");
  });
});

describe("json import checks", () => {
  const opts = { source: "json" as const, playerId: "json:me" };
  const base = { moves: ["e4", "e5"], color: "white", result: "1-0", date: "2024-01-01", opponent: "x", time_control: "blitz", time_control_raw: "300+0" };
  it("drops variants and counts them", () => {
    const stats = { skipped: 0 };
    const list = [
      { ...base, game_id: "ok" },
      { ...base, game_id: "drop", moves: ["e4", "d5", "exd5", "Qxd5", "N@e4"] },
      { ...base, game_id: "3c", termination: "me won by checking the opponent king for the 3rd time" },
      { ...base, game_id: "rules", rules: "kingofthehill" },
      { ...base, game_id: "lv", variant: "atomic" },
      { ...base, game_id: "960", initial_setup: "nrbkqbrn/pppppppp/8/8/8/8/PPPPPPPP/NRBKQBRN w KQkq - 0 1" },
      { ...base, game_id: "std", initial_setup: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", rules: "chess" },
      { ...base, game_id: "illegal", moves: ["e4", "Nge7"] },
      { ...base, game_id: "mate?", moves: ["e4", "e5", "Qh5#"] },
    ];
    const g = parseStoreJson(JSON.stringify(list), opts, stats);
    expect(g.map((x) => x.game_id)).toEqual(["ok", "std"]);
    expect(stats.skipped).toBe(7);
  });
  it("missing game_id becomes a content hash, not a position", () => {
    const a = parseStoreJson(JSON.stringify([{ ...base }, { ...base, opponent: "y" }]), opts);
    const b = parseStoreJson(JSON.stringify([{ ...base, opponent: "y" }]), opts);
    expect(a[0].game_id).toMatch(/^json-[0-9a-f]{16}$/);
    expect(a[0].game_id).not.toBe(a[1].game_id);
    expect(b[0].game_id).toBe(a[1].game_id);
  });
  it("keeps a well-formed per-game source/playerId, ignores malformed ones", () => {
    const list = [
      { ...base, game_id: "1", source: "chess.com", playerId: "chess.com:hero" },
      { ...base, game_id: "2", source: "chess.com", playerId: "lichess:hero" },
      { ...base, game_id: "3", source: "evil", playerId: "evil:x" },
      { ...base, game_id: "4", source: "lichess", playerId: "lichess:Hero" },
    ];
    const g = parseStoreJson(JSON.stringify(list), opts);
    expect(g.map((x) => x.playerId)).toEqual(["chess.com:hero", "json:me", "json:me", "json:me"]);
    expect(g[0].source).toBe("chess.com");
  });
  it("re-labels time controls from the raw value", () => {
    const list = [
      // Lichess (old CLI): chess.com thresholds and "N days per move"
      { ...base, game_id: "l1", url: "https://lichess.org/aaaa", time_control: "blitz", time_control_raw: "480+0" },
      { ...base, game_id: "l2", url: "https://lichess.org/bbbb", time_control: "rapid", time_control_raw: "3 days per move" },
      // chess.com keeps its own time_class (10 minutes was blitz before 2017)
      { ...base, game_id: "c1", url: "https://www.chess.com/game/live/1", time_control: "blitz", time_control_raw: "600" },
      // anything else is recomputed
      { ...base, game_id: "g1", url: "", time_control: "rapid", time_control_raw: "1 day per move" },
      { ...base, game_id: "g2", url: "", time_control: "classical", time_control_raw: "" },
    ];
    const g = parseStoreJson(JSON.stringify(list), opts);
    expect(g.map((x) => [x.time_control, x.time_control_raw])).toEqual([
      ["rapid", "480+0"],
      ["daily", "1/259200"],
      ["blitz", "600"],
      ["daily", "1 day per move"],
      ["classical", ""],
    ]);
  });
});

describe("chess.com and lichess variant checks (C4d)", () => {
  const raw = JSON.parse(rd("api/chesscom_game.json")) as ChessComRawGame;
  it("chess.com: initial_setup and SetUp", () => {
    expect(parseChessComGame({ ...raw, initial_setup: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" }, "hero")).not.toBeNull();
    expect(parseChessComGame({ ...raw, initial_setup: "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" }, "hero")).toBeNull();
    expect(parseChessComGame({ ...raw, pgn: `[SetUp "1"]\n[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]\n${raw.pgn}` }, "hero")).toBeNull();
    expect(parseChessComGame({ ...raw, pgn: raw.pgn!.replace("2. Nf3", "2. Nf6") }, "hero")).toBeNull();
  });
  it("lichess: initialFen, illegal moves; ongoing helpers", () => {
    const l = JSON.parse(rd("api/lichess_game.json")) as LichessRawGame;
    expect(parseLichessGame({ ...l, initialFen: "8/8/8/8/8/8/8/K6k w - - 0 1" }, "hero")).toBeNull();
    expect(parseLichessGame({ ...l, moves: "e4 e5 Ke3" }, "hero")).toBeNull();
    expect(isOngoing({ ...l, status: "started" })).toBe(true);
    expect(isOngoing({ ...l, status: "created" })).toBe(true);
    expect(isOngoing(l)).toBe(false);
  });
  it("requests oldest first including ongoing games", async () => {
    let url = "";
    const fetchImpl = (async (u: string | URL | Request) => {
      url = String(u);
      return new Response("");
    }) as unknown as typeof fetch;
    for await (const g of fetchLichessGames("Hero", { fetchImpl })) void g;
    const q = new URL(url).searchParams;
    expect(q.get("sort")).toBe("dateAsc");
    expect(q.get("ongoing")).toBe("true");
  });
});
