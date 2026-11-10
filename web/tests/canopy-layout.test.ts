import { describe, expect, it } from "vitest";
import { canopyBox, layoutCanopy, slotX } from "@/lib/canopy/layout";
import { syntheticSpec, treeFromSpec } from "@/lib/canopy/fixtures";
import { buildHitIndex } from "@/lib/canopy/hit-test";

const spec = {
  kids: [
    { san: "e4", kids: [{ san: "e5", kids: [{ san: "Nf3", w: 3 }, { san: "Bc4", d: 2 }, { san: "d4", l: 1 }] }, { san: "c5", w: 2, l: 2 }, { san: "e6", w: 1 }] },
    { san: "d4", kids: [{ san: "d5", w: 2, d: 1 }, { san: "Nf6", l: 1 }] },
    { san: "c4", w: 1 },
  ],
};
const box = canopyBox(700, 500);

describe("layoutCanopy", () => {
  const t = treeFromSpec(spec);
  it("is deterministic", () => {
    const a = layoutCanopy(t, box);
    const b = layoutCanopy(t, box);
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
    expect(Array.from(a.y)).toEqual(Array.from(b.y));
    expect(Array.from(a.r)).toEqual(Array.from(b.r));
  });
  it("places every inner node at the games-weighted mean of its children (before flare)", () => {
    const xs = slotX(t);
    for (let i = 0; i < t.n; i++) {
      const c = t.childCount[i];
      if (!c) continue;
      let g = 0;
      let acc = 0;
      for (let j = 0; j < c; j++) {
        const id = t.firstChild[i] + j;
        g += t.games[id];
        acc += t.games[id] * xs[id];
      }
      expect(xs[i]).toBeCloseTo(acc / g, 9);
    }
  });
  it("keeps all x within [gutter, width - padRight]", () => {
    const big = treeFromSpec(syntheticSpec(1500, 3));
    for (const tree of [t, big]) {
      const l = layoutCanopy(tree, box);
      for (let i = 0; i < tree.n; i++) {
        expect(l.x[i]).toBeGreaterThanOrEqual(box.gutter);
        expect(l.x[i]).toBeLessThanOrEqual(box.width - box.padRight);
        expect(Number.isFinite(l.y[i])).toBe(true);
      }
    }
  });
  it("is a trunk that opens into a crown", () => {
    const big = treeFromSpec(syntheticSpec(1500, 5));
    const l = layoutCanopy(big, box);
    const spread = (pred: (i: number) => boolean) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 1; i < big.n; i++) if (pred(i)) {
        lo = Math.min(lo, l.x[i]);
        hi = Math.max(hi, l.x[i]);
      }
      return hi - lo;
    };
    const row1 = spread((i) => big.depth[i] === 1);
    const crown = spread((i) => big.kind[i] === 3);
    expect(row1).toBeLessThan(crown);
    expect(crown).toBeGreaterThan(box.width * 0.5);
  });
  it("puts the most popular child nearest the center", () => {
    const l = layoutCanopy(t, box);
    const kids = [1, 2, 3];
    const dist = kids.map((i) => Math.abs(l.x[i] - l.rootX));
    expect(t.games[1]).toBeGreaterThanOrEqual(t.games[2]);
    expect(dist[0]).toBeLessThanOrEqual(Math.min(dist[1], dist[2]) + 1e-3);
  });
  it("sizes strokes and discs from the share of the root", () => {
    const l = layoutCanopy(t, box);
    expect(l.w[0]).toBe(2.5);
    expect(l.w[1]).toBeGreaterThan(l.w[3]);
    expect(l.w[1]).toBeLessThanOrEqual(2.5);
    const leaf = t.kind.findIndex((k, i) => i > 0 && k === 3);
    expect(l.w[leaf]).toBeCloseTo(0.6, 6);
    expect(l.r[leaf]).toBe(1.75);
    expect(l.r[1]).toBeGreaterThan(2.25);
    expect(l.r[1]).toBeLessThanOrEqual(5.5);
    expect(l.bx[leaf]).toBe(l.x[t.parent[leaf]]);
  });
  it("runs single-game tails along their flare line from a knee one row above the parent", () => {
    const big = treeFromSpec(syntheticSpec(800, 4));
    const l = layoutCanopy(big, box);
    for (let i = 1; i < big.n; i++) {
      for (const v of [l.kx[i], l.ky[i], l.tk[i], l.tt[i]]) expect(Number.isFinite(v)).toBe(true);
      if (big.kind[i] === 3) {
        const p = big.parent[i];
        expect(l.ky[i]).toBeCloseTo(l.rows.y(Math.min(big.depth[i], big.depth[p] + 1)), 3);
        expect(l.ky[i]).toBeGreaterThanOrEqual(l.y[i] - 1e-3);
      } else {
        expect(l.kx[i]).toBe(l.x[i]);
        expect(l.ky[i]).toBe(l.y[i]);
      }
    }
    // Tails reaching the same knee row keep their slot order at the knee and at the tip.
    const tails = Array.from({ length: big.n }, (_, i) => i).filter((i) => big.kind[i] === 3);
    const sorted = [...tails].sort((a, b) => l.kx[a] - l.kx[b]);
    const xs = slotX(big);
    for (let j = 1; j < sorted.length; j++) expect(xs[sorted[j]]).toBeGreaterThanOrEqual(xs[sorted[j - 1]] - 0.2);
    expect(l.leafScale).toBeGreaterThanOrEqual(0.65);
    expect(l.leafScale).toBeLessThanOrEqual(1);
  });
  it("handles a single-node tree", () => {
    const one = layoutCanopy(treeFromSpec({}), box);
    expect(one.n).toBe(1);
    expect(Number.isFinite(one.x[0])).toBe(true);
    expect(one.y[0]).toBeLessThan(one.groundY);
  });
});

describe("hit index", () => {
  const t = treeFromSpec(spec);
  const l = layoutCanopy(t, box);
  const idx = buildHitIndex(l);
  it("finds the nearest node within the radius", () => {
    for (let i = 1; i < t.n; i++) expect(idx.nearest(l.x[i] + 1, l.y[i] - 1, 6)).toBe(i);
  });
  it("returns -1 outside the radius", () => {
    expect(idx.nearest(-500, -500, 10)).toBe(-1);
    expect(idx.nearest(l.x[1] + 40, l.y[1], 5)).not.toBe(1);
  });
  it("never returns the root", () => {
    expect(idx.nearest(l.x[0], l.y[0], 3)).not.toBe(0);
    const only = buildHitIndex(layoutCanopy(treeFromSpec({}), box));
    expect(only.nearest(l.x[0], l.y[0], 50)).toBe(-1);
  });
  it("agrees with brute force on a big tree", () => {
    const big = treeFromSpec(syntheticSpec(800, 9));
    const bl = layoutCanopy(big, box);
    const bi = buildHitIndex(bl);
    for (let q = 0; q < 200; q++) {
      const wx = 36 + ((q * 37) % 650);
      const wy = 20 + ((q * 91) % 430);
      let best = -1;
      let bd = 12 * 12;
      for (let i = 1; i < big.n; i++) {
        const d = (bl.x[i] - wx) ** 2 + (bl.y[i] - wy) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      const got = bi.nearest(wx, wy, 12);
      if (best === -1) expect(got).toBe(-1);
      else expect((bl.x[got] - wx) ** 2 + (bl.y[got] - wy) ** 2).toBeCloseTo(bd, 3);
    }
  });
});
