import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { GameIndex } from "@/lib/engine/position-index";
import { growCanopy, snapshotCanopy } from "@/lib/engine/canopy-tree";
import { FRONTIER, LEAF } from "@/lib/canopy/types";
import type { Color, Game } from "@/lib/engine/types";

const file = process.env.CANOPY_BENCH_FILE;

describe.skipIf(!file)("canopy benchmark (local data, opt-in)", () => {
  it("first call within budget, then completion", async () => {
    const raw = JSON.parse(readFileSync(file!, "utf8")) as { games: Game[] };
    const all = raw.games.map((g) => ({ ...g, source: "json" as const, playerId: "json:bench" }));
    for (const color of ["white", "black"] as Color[]) {
      const idx = new GameIndex(all.filter((g) => g.color === color), true);
      const root = idx.root;
      const fen = new Chess().fen();
      const t0 = performance.now();
      await growCanopy(idx, root, fen, 0, new Chess(), { budgetMs: 120 });
      const workerMs = performance.now() - t0;
      const s0 = performance.now();
      const first = snapshotCanopy(idx, root, 0, { key: "b", path: [], color, selectionGames: all.length });
      const snapMs = performance.now() - s0;
      const c0 = performance.now();
      await growCanopy(idx, root, fen, 0, new Chess(), { budgetMs: Infinity });
      const completeMs = performance.now() - c0;
      const full = snapshotCanopy(idx, root, 0, { key: "b", path: [], color, selectionGames: all.length });
      const count = (k: number) => full.kind.reduce((n, x) => n + (x === k ? 1 : 0), 0);
      const r0 = performance.now();
      await growCanopy(idx, root, fen, 0, new Chess(), { budgetMs: Infinity });
      const revisitMs = performance.now() - r0;
      const v0 = performance.now();
      snapshotCanopy(idx, root, 0, { key: "b", path: [], color, selectionGames: all.length });
      const revSnap = performance.now() - v0;
      console.log(
        `${color}: first call ${workerMs.toFixed(0)} ms (+snapshot ${snapMs.toFixed(1)} ms, ${first.n} nodes, complete=${first.complete}), ` +
          `completion ${completeMs.toFixed(0)} ms, total nodes ${full.n} (inner ${full.n - count(LEAF) - count(FRONTIER)}, leaves ${count(LEAF)}), ` +
          `depthCap ${full.depthCap}, revisit ${revisitMs.toFixed(1)} + snapshot ${revSnap.toFixed(1)} ms`,
      );
      expect(workerMs).toBeLessThanOrEqual(160);
      expect(full.complete).toBe(true);
    }
  }, 60_000);
});
