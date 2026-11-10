import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { buildColorTries, filterGames } from "@/lib/engine/filter";
import { GameIndex } from "@/lib/engine/position-index";
import { nextMovesForPath } from "@/lib/engine/trie";
import { canopyBuffers, growCanopy, snapshotCanopy, type SnapshotOptions } from "@/lib/engine/canopy-tree";
import { BUNDLE, FRONTIER, LEAF, NODE, ROOT, type CanopyTree } from "@/lib/canopy/types";
import type { Color, Filters, Game } from "@/lib/engine/types";

const golden = JSON.parse(readFileSync("tests/fixtures/golden/explorer_golden.json", "utf8")) as {
  cases: Array<{ filters: Filters; color: Color; path: string[]; stats: unknown; next: Array<{ move: string; stats: { total: number; wins: number; draws: number; losses: number } }> }>;
};
const sample = JSON.parse(readFileSync("tests/fixtures/golden/sample_games.json", "utf8"));
const games: Game[] = sample.games.map((g: Game) => ({ ...g, source: "json", playerId: "json:x" }));

const mk = (moves: string, o: Partial<Game> = {}): Game => ({
  game_id: moves + (o.result ?? ""), moves: moves ? moves.split(" ") : [], result: "1-0", color: "white", date: "2024-01-01", opponent: "o",
  my_rating: null, opponent_rating: null, time_control: "blitz", time_control_raw: "", termination: "", url: "", source: "json", playerId: "json:x", ...o,
});

/** Deterministic pseudo-random legal games that share long prefixes (moves skew to the first few legal ones). */
function synthGames(n: number, seed = 7): Game[] {
  let st = seed;
  const rnd = () => {
    st = (Math.imul(st, 1664525) + 1013904223) >>> 0;
    return st / 2 ** 32;
  };
  const out: Game[] = [];
  for (let g = 0; g < n; g++) {
    const c = new Chess();
    const len = 4 + Math.floor(rnd() * 36);
    while (c.history().length < len && !c.isGameOver()) {
      const ms = c.moves();
      c.move(ms[Math.floor(rnd() ** 3 * ms.length)]);
    }
    const r = rnd();
    out.push(mk(c.history().join(" "), { game_id: `g${g}`, result: r < 0.4 ? "1-0" : r < 0.7 ? "0-1" : "1/2-1/2" }));
  }
  return out;
}
const synth = synthGames(250);

function boardFor(path: string[]) {
  return (d: number) => {
    const c = new Chess();
    for (const m of path.slice(0, d)) c.move(m);
    return c;
  };
}
const fenAfter = (path: string[]) => boardFor(path)(path.length).fen();

async function grow(idx: GameIndex, path: string[], budgetMs = Infinity, extra: Partial<SnapshotOptions> = {}, board = new Chess()) {
  const node = idx.nodeAt(path, boardFor(path));
  if (!node) return null;
  await growCanopy(idx, node, fenAfter(path), path.length, board, { budgetMs });
  return snapshotCanopy(idx, node, path.length, { key: "k", path, color: "white", selectionGames: idx.games.length, ...extra });
}

function relPath(t: CanopyTree, i: number): string[] {
  const out: string[] = [];
  for (let k = i; t.parent[k] >= 0; k = t.parent[k]) out.unshift(t.san[k]);
  return out;
}

function checkInvariants(t: CanopyTree) {
  expect(t.kind[0]).toBe(ROOT);
  expect(t.parent[0]).toBe(-1);
  for (let i = 0; i < t.n; i++) {
    if (i > 0) expect(t.parent[i]).toBeLessThan(i);
    const c = t.childCount[i];
    if (c > 0) {
      const f = t.firstChild[i];
      let g = 0;
      let w = 0;
      let d = 0;
      let l = 0;
      for (let j = f; j < f + c; j++) {
        expect(t.parent[j]).toBe(i);
        g += t.games[j];
        w += t.wins[j];
        d += t.draws[j];
        l += t.losses[j];
        expect(t.depth[j]).toBeGreaterThanOrEqual(t.branchDepth[j]);
      }
      expect(t.games[i]).toBe(g + t.ended[i]);
      expect(t.wins[i]).toBeGreaterThanOrEqual(w);
      expect(t.draws[i]).toBeGreaterThanOrEqual(d);
      expect(t.losses[i]).toBeGreaterThanOrEqual(l);
      // table order: games desc
      for (let j = f + 1; j < f + c; j++) if (t.kind[j] !== BUNDLE) expect(t.games[j - 1]).toBeGreaterThanOrEqual(t.games[j]);
    } else {
      expect(t.ended[i]).toBe(t.games[i]);
    }
    if (t.kind[i] === NODE || t.kind[i] === ROOT) {
      // wins/draws/losses are conserved too unless games end here with a result
      expect(t.wins[i] + t.draws[i] + t.losses[i]).toBe(t.games[i]);
    }
  }
}

describe("growCanopy / snapshotCanopy parity", () => {
  it("matches the eager trie, the golden stats and the move table on every golden case", async () => {
    let checked = 0;
    for (const c of golden.cases) {
      if (c.filters.moves_start) continue;
      const filtered = filterGames(games, c.filters);
      const side = filtered.filter((g) => g.color === c.color);
      const idx = new GameIndex(side, true);
      const t = await grow(idx, c.path);
      if (!t) continue; // out of book
      const eagerTrie = buildColorTries(filtered)[c.color];
      expect(t.rootStats, JSON.stringify(c)).toEqual(c.stats);
      expect(t.complete).toBe(true);
      // root children == golden `next`
      const rootKids = Array.from({ length: t.childCount[0] }, (_, j) => t.firstChild[0] + j);
      const got = rootKids.map((j) => ({ move: t.san[j], total: t.games[j], wins: t.wins[j], draws: t.draws[j], losses: t.losses[j] }));
      expect(got, JSON.stringify(c)).toEqual(c.next.map((m) => ({ move: m.move, total: m.stats.total, wins: m.stats.wins, draws: m.stats.draws, losses: m.stats.losses })));
      checkInvariants(t);
      for (let i = 0; i < t.n; i++) {
        const full = [...c.path, ...relPath(t, i)];
        if (t.kind[i] === NODE || t.kind[i] === ROOT) {
          const eager = nextMovesForPath(eagerTrie, full).next;
          const kids = Array.from({ length: t.childCount[i] }, (_, j) => t.firstChild[i] + j);
          expect(
            kids.map((j) => [t.san[j], t.games[j], t.wins[j], t.draws[j], t.losses[j]]),
            full.join(" "),
          ).toEqual(eager.map((m) => [m.move, m.stats.total, m.stats.wins, m.stats.draws, m.stats.losses]));
        } else if (t.kind[i] === LEAF) {
          expect(t.games[i]).toBe(1);
          const g = idx.games[t.leafRef[i]];
          expect(g.moves.slice(0, full.length)).toEqual(full);
          expect(t.leafLen[i]).toBe(g.moves.length);
          expect(t.branchDepth[i]).toBe(t.depth[t.parent[i]] + 1);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("matches the eager trie node by node on synthetic games", async () => {
    const eagerTrie = buildColorTries(synth)["white"];
    for (const path of [[], ["e4"], ["d4", "d5"]]) {
      const idx = new GameIndex(synth, true);
      const t = await grow(idx, path);
      if (!t) continue;
      checkInvariants(t);
      let inner = 0;
      for (let i = 0; i < t.n; i++) {
        if (t.kind[i] !== NODE && t.kind[i] !== ROOT) continue;
        inner++;
        const eager = nextMovesForPath(eagerTrie, [...path, ...relPath(t, i)]).next;
        const kids = Array.from({ length: t.childCount[i] }, (_, j) => t.firstChild[i] + j);
        expect(kids.map((j) => [t.san[j], t.games[j], t.wins[j], t.draws[j], t.losses[j]])).toEqual(
          eager.map((m) => [m.move, m.stats.total, m.stats.wins, m.stats.draws, m.stats.losses]),
        );
      }
      expect(inner).toBeGreaterThan(path.length ? 3 : 20);
    }
  });

  it("is deterministic and identical across the cache state of the index", async () => {
    const side = synth;
    const a = await grow(new GameIndex(side, true), []);
    const b = await grow(new GameIndex(side, true), []);
    expect(a).toEqual(b);
    const idx = new GameIndex(side, true);
    await grow(idx, []);
    expect(await grow(idx, [])).toEqual(a); // second call walks the cached nodes
  });

  it("budget 0 gives the root plus FRONTIER children; repeated rounds converge to the full tree", async () => {
    const side = synth;
    const full = (await grow(new GameIndex(side, true), []))!;
    expect(full.n).toBeGreaterThan(20);

    const idx = new GameIndex(side, true);
    const first = (await grow(idx, [], 0))!;
    checkInvariants(first);
    expect(first.kind[0]).toBe(ROOT);
    expect(first.complete).toBe(false);
    const kinds = new Set(Array.from({ length: first.childCount[0] }, (_, j) => first.kind[first.firstChild[0] + j]));
    expect(kinds.has(FRONTIER)).toBe(true);
    // provisional leaves under a FRONTIER have no san and a game ref
    const fi = Array.from({ length: first.n }, (_, i) => i).find((i) => first.kind[i] === FRONTIER)!;
    const pl = first.firstChild[fi];
    expect(first.kind[pl]).toBe(LEAF);
    expect(first.san[pl]).toBe("");
    expect(first.leafRef[pl]).toBeGreaterThanOrEqual(0);

    let tick = 0;
    let t = first;
    for (let r = 0; r < 10_000 && !t.complete; r++) {
      const node = idx.root;
      await growCanopy(idx, node, fenAfter([]), 0, new Chess(), { budgetMs: 3, now: () => tick++ });
      t = snapshotCanopy(idx, node, 0, { key: "k", path: [], color: "white", selectionGames: side.length });
      checkInvariants(t);
    }
    expect(t.complete).toBe(true);
    expect(t).toEqual(full);
  });

  it("stops at a yield when shouldStop says so", async () => {
    const side = synth;
    const idx = new GameIndex(side, true);
    let calls = 0;
    const done = await growCanopy(idx, idx.root, fenAfter([]), 0, new Chess(), {
      budgetMs: Infinity, sliceMs: 0, now: () => 0, shouldStop: () => ++calls > 0, yieldFn: async () => {},
    });
    expect(done).toBe(false);
  });

  it("maxDepth clamps tips and keeps leafLen; maxLeaves bundles", async () => {
    const side = synth;
    const idx = new GameIndex(side, true);
    const full = (await grow(idx, []))!;
    const clamped = (await grow(idx, [], Infinity, { maxDepth: 4 }))!;
    expect(clamped.depthCap).toBe(4);
    let sawClamp = false;
    for (let i = 0; i < clamped.n; i++) {
      expect(clamped.depth[i]).toBeLessThanOrEqual(4);
      if (clamped.kind[i] === LEAF) {
        const g = idx.games[clamped.leafRef[i]];
        expect(clamped.leafLen[i]).toBe(g.moves.length);
        if (g.moves.length > 4) sawClamp = true;
      }
    }
    expect(sawClamp).toBe(true);
    expect(full.depthCap).toBeGreaterThanOrEqual(16);

    const capped = (await grow(idx, [], Infinity, { maxLeaves: 3 }))!;
    expect(capped.capped).toBe(true);
    let bundles = 0;
    let gamesInTree = 0;
    for (let i = 0; i < capped.n; i++) {
      if (capped.kind[i] === BUNDLE) {
        bundles++;
        expect(capped.games[i]).toBeGreaterThanOrEqual(2);
        expect(capped.leafRef[i]).toBe(-1);
      }
      if (capped.kind[i] === LEAF || capped.kind[i] === BUNDLE) gamesInTree += capped.games[i];
    }
    expect(bundles).toBeGreaterThan(0);
    // no game is lost: leaves + bundles + games that end inside the tree = all games
    let endedInside = 0;
    for (let i = 0; i < capped.n; i++) if (capped.kind[i] === NODE || capped.kind[i] === ROOT) endedInside += capped.ended[i];
    expect(gamesInTree + endedInside).toBe(capped.games[0]);
    checkInvariants(capped);
  });

  it("maxNodes leaves the rest FRONTIER and incomplete", async () => {
    const side = synth;
    const t = (await grow(new GameIndex(side, true), [], Infinity, { maxNodes: 3 }))!;
    expect(t.complete).toBe(false);
    checkInvariants(t);
  });

  it("merges check-mark variants and drops illegal moves (legal mode)", async () => {
    const idx = new GameIndex(
      [mk("e4 e5 Bc4 Nc6 Bxf7+"), mk("e4 e5 Bc4 Nc6 Bxf7", { result: "0-1" }), mk("e4 e5 Bc4 Nc6 0-0"), mk("Nge7 d5"), mk("e4 e5 Bc4 Nc6 Qh5")],
      true,
    );
    const t = (await grow(idx, []))!;
    checkInvariants(t);
    const path = ["e4", "e5", "Bc4", "Nc6"];
    const node = Array.from({ length: t.n }, (_, i) => i).find((i) => relPath(t, i).join(" ") === path.join(" "))!;
    expect(node).toBeGreaterThan(0);
    const kids = Array.from({ length: t.childCount[node] }, (_, j) => t.firstChild[node] + j);
    expect(kids.map((j) => [t.san[j], t.games[j]])).toEqual([["Bxf7+", 2], ["Qh5", 1]]);
    expect(t.wins[kids[0]]).toBe(1);
    expect(t.losses[kids[0]]).toBe(1);
    expect(t.kind[kids[1]]).toBe(LEAF);
    expect(t.ended[node]).toBe(1); // the 0-0 game: illegal there, dropped
    // the Nge7 game is illegal from the start and never shows up as a child of the root
    expect(t.childCount[0]).toBe(1);
  });

  it("exposes transferable buffers", async () => {
    const side = synth;
    const t = (await grow(new GameIndex(side, true), []))!;
    const bufs = canopyBuffers(t);
    expect(bufs.length).toBe(13);
    expect(new Set(bufs).size).toBe(13);
  });
});
