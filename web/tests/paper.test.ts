import { describe, expect, it } from "vitest";
import {
  createRng,
  deckledPath,
  edgeProfile,
  fibreStrands,
  handArrow,
  hashSeed,
  isWellFormedPath,
  pathPoints,
  svgDataUri,
  tapePath,
  tornEdgeLine,
  tornStripPath,
  wobbleLine,
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

describe("edge profile and torn strip", () => {
  it("stays within [0, amp] and spans the width", () => {
    const pts = edgeProfile(3, 640, 9);
    expect(pts[0].x).toBe(0);
    expect(pts[pts.length - 1].x).toBe(640);
    for (const p of pts) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(9);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(640);
    }
  });

  it("is deterministic and seed dependent", () => {
    expect(tornStripPath(1, 640, 14, 9)).toBe(tornStripPath(1, 640, 14, 9));
    expect(tornStripPath(1, 640, 14, 9)).not.toBe(tornStripPath(2, 640, 14, 9));
  });

  it("loops: first and last height agree so the tile is seamless", () => {
    const pts = edgeProfile(5, 400, 8, { loop: true });
    expect(pts[0].y).toBe(pts[pts.length - 1].y);
  });

  it("is a valid closed path inside its box, and the lift raises the edge", () => {
    const d = tornStripPath(4, 300, 14, 9, { loop: true });
    expect(isWellFormedPath(d)).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    for (const p of pathPoints(d)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(300);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(14);
    }
    const low = Math.max(...pathPoints(tornStripPath(4, 300, 14, 9)).map((p) => p.y));
    const high = Math.max(...pathPoints(tornStripPath(4, 300, 14, 9, { lift: 2 })).map((p) => p.y));
    expect(high).toBeLessThan(low);
  });

  it("the open edge line is valid path data", () => {
    expect(isWellFormedPath(tornEdgeLine(9, 200, 6))).toBe(true);
  });
});

describe("tape", () => {
  it("is a valid closed polygon inside length x height with serrated ends", () => {
    for (const seed of [1, 2, 3, "ochre-a"]) {
      const d = tapePath(seed, 96, 22);
      expect(isWellFormedPath(d)).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
      const pts = pathPoints(d);
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(96);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(22);
      }
      // the ends are really zig-zags: several distinct x values within the first teeth
      const leftXs = new Set(pts.filter((p) => p.x < 5).map((p) => p.x));
      expect(leftXs.size).toBeGreaterThanOrEqual(4);
    }
  });

  it("is deterministic", () => {
    expect(tapePath("a", 90, 20)).toBe(tapePath("a", 90, 20));
    expect(tapePath("a", 90, 20)).not.toBe(tapePath("b", 90, 20));
  });
});

describe("deckled sheet", () => {
  it("keeps every point inside the box with small inward offsets", () => {
    const d = deckledPath(11, 420, 700, 1.6);
    expect(isWellFormedPath(d)).toBe(true);
    for (const p of pathPoints(d)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(420);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(700);
    }
    expect(deckledPath(11, 420, 700, 1.6)).toBe(d);
  });
});

describe("hand-drawn lines", () => {
  it("wobbleLine starts and ends exactly on the endpoints and stays near the chord", () => {
    const d = wobbleLine(2, 4, 10, 120, 12, 1.2);
    expect(isWellFormedPath(d)).toBe(true);
    const pts = pathPoints(d);
    expect(pts[0]).toEqual({ x: 4, y: 10 });
    expect(pts[pts.length - 1]).toEqual({ x: 120, y: 12 });
    for (const p of pts) expect(Math.abs(p.y - (10 + ((p.x - 4) / 116) * 2))).toBeLessThanOrEqual(1.4);
    expect(wobbleLine(2, 4, 10, 120, 12, 1.2)).toBe(d);
  });

  it("handArrow is valid, deterministic, and ends at the tip", () => {
    const d = handArrow(5, 2, 2, 60, 30, 5);
    expect(isWellFormedPath(d)).toBe(true);
    expect(handArrow(5, 2, 2, 60, 30, 5)).toBe(d);
    expect(d).toContain("60 30");
  });

  it("fibreStrands returns the requested count of valid strands inside the box", () => {
    const strands = fibreStrands(3, 300, 300, 24, { margin: 6 });
    expect(strands).toHaveLength(24);
    for (const s of strands) {
      expect(isWellFormedPath(s)).toBe(true);
      for (const p of pathPoints(s)) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(300);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(300);
      }
    }
  });
});

describe("path validator and data uri", () => {
  it("rejects malformed path data", () => {
    expect(isWellFormedPath("L1 2")).toBe(false);
    expect(isWellFormedPath("M1")).toBe(false);
    expect(isWellFormedPath("M1 2L3")).toBe(false);
    expect(isWellFormedPath("M1 2 foo")).toBe(false);
    expect(isWellFormedPath("M1 2L3 4Z")).toBe(true);
  });

  it("svgDataUri produces an encoded svg uri", () => {
    const u = svgDataUri("<svg xmlns='http://www.w3.org/2000/svg'><path d='M0 0'/></svg>");
    expect(u.startsWith("data:image/svg+xml,")).toBe(true);
    expect(u).not.toMatch(/[<>'"]/);
  });
});
