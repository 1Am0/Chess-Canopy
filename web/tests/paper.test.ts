import { describe, expect, it } from "vitest";
import {
  createRng,
  hashSeed,
  inkArrowPath,
  inkEllipsePath,
  inkStrokePath,
  isWellFormedPath,
  pathPoints,
} from "@/lib/paper";

describe("seeded rng", () => {
  it("repeats for the same seed and differs between seeds", () => {
    const a = createRng(7);
    const b = createRng(7);
    const c = createRng(8);
    const sa = Array.from({ length: 8 }, () => a.next());
    const sb = Array.from({ length: 8 }, () => b.next());
    const sc = Array.from({ length: 8 }, () => c.next());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("accepts string seeds and keeps range/int in bounds", () => {
    expect(hashSeed("tape-1")).toBe(hashSeed("tape-1"));
    expect(hashSeed("tape-1")).not.toBe(hashSeed("tape-2"));
    const r = createRng("x");
    for (let i = 0; i < 200; i++) {
      const v = r.range(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(5);
      const k = r.int(2, 4);
      expect(Number.isInteger(k) && k >= 2 && k <= 4).toBe(true);
    }
  });
});

describe("path validator", () => {
  it("rejects malformed path data", () => {
    expect(isWellFormedPath("L1 2")).toBe(false);
    expect(isWellFormedPath("M1")).toBe(false);
    expect(isWellFormedPath("M1 2L3")).toBe(false);
    expect(isWellFormedPath("M1 2 foo")).toBe(false);
    expect(isWellFormedPath("M1 2L3 4Z")).toBe(true);
  });
});

describe("stroke generators", () => {
  const bbox = (d: string) => {
    const pts = pathPoints(d);
    return {
      minX: Math.min(...pts.map((p) => p.x)),
      maxX: Math.max(...pts.map((p) => p.x)),
      minY: Math.min(...pts.map((p) => p.y)),
      maxY: Math.max(...pts.map((p) => p.y)),
    };
  };

  it("inkArrowPath is deterministic, well formed and seed dependent", () => {
    const a = inkArrowPath("e2e4", 10, 10, 200, 90, { width: 6 });
    expect(isWellFormedPath(a)).toBe(true);
    expect(a.endsWith("Z")).toBe(true);
    expect(inkArrowPath("e2e4", 10, 10, 200, 90, { width: 6 })).toBe(a);
    expect(inkArrowPath("d2d4", 10, 10, 200, 90, { width: 6 })).not.toBe(a);
  });

  it("inkArrowPath puts the tip exactly on the target and stays near the line", () => {
    const x2 = 180;
    const y2 = 40;
    const d = inkArrowPath(5, 20, 100, x2, y2, { width: 5 });
    expect(d).toContain(`${x2} ${y2}`);
    const b = bbox(d);
    const slack = 5 * 2 + 4;
    expect(b.minX).toBeGreaterThanOrEqual(20 - slack);
    expect(b.maxX).toBeLessThanOrEqual(x2 + slack);
    expect(b.minY).toBeGreaterThanOrEqual(y2 - slack);
    expect(b.maxY).toBeLessThanOrEqual(100 + slack);
  });

  it("inkArrowPath copes with tiny and zero-length arrows and keeps a fixed size", () => {
    expect(isWellFormedPath(inkArrowPath(1, 5, 5, 5, 5))).toBe(true);
    expect(isWellFormedPath(inkArrowPath(1, 5, 5, 6, 5.5, { width: 8 }))).toBe(true);
    const count = (d: string) => (d.match(/[MLQ]/g) ?? []).length;
    expect(count(inkArrowPath(2, 0, 0, 40, 0))).toBe(count(inkArrowPath(2, 0, 0, 400, 300)));
  });

  it("inkArrowPath is fast enough to run for every arrow on every render", () => {
    const t0 = performance.now();
    for (let i = 0; i < 4000; i++) inkArrowPath(i, 0, 0, 120 + (i % 50), 60);
    expect(performance.now() - t0).toBeLessThan(400);
  });

  it("inkStrokePath tapers: thinner at the start than in the middle", () => {
    const d = inkStrokePath(3, 0, 50, 200, 50, { width: 8, wobble: 0 });
    expect(isWellFormedPath(d)).toBe(true);
    const pts = pathPoints(d).filter((p) => p.x > -1 && p.x < 201);
    const spread = (lo: number, hi: number) => {
      const ys = pts.filter((p) => p.x >= lo && p.x <= hi).map((p) => p.y);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(spread(0, 10)).toBeLessThan(spread(80, 120));
  });

  it("inkEllipsePath stays near its box, is open and deterministic", () => {
    const d = inkEllipsePath("c", 60, 24);
    expect(isWellFormedPath(d)).toBe(true);
    expect(d.endsWith("Z")).toBe(false);
    expect(inkEllipsePath("c", 60, 24)).toBe(d);
    expect(inkEllipsePath("c2", 60, 24)).not.toBe(d);
    const b = bbox(d);
    expect(b.minX).toBeGreaterThanOrEqual(-3);
    expect(b.maxX).toBeLessThanOrEqual(63);
    expect(b.minY).toBeGreaterThanOrEqual(-3);
    expect(b.maxY).toBeLessThanOrEqual(27);
  });
});
