import { describe, expect, it } from "vitest";
import { makeRowScale, moveTicks } from "@/lib/canopy/rows";

describe("makeRowScale", () => {
  const D = 60;
  const s = makeRowScale(D, 16, 400);
  it("maps depth 0 to bottom and depthCap to top", () => {
    expect(s.y(0)).toBeCloseTo(400, 6);
    expect(s.y(D)).toBeCloseTo(16, 6);
  });
  it("is strictly monotonic (higher plies are higher up)", () => {
    for (let d = 1; d <= D; d++) expect(s.y(d)).toBeLessThan(s.y(d - 1));
  });
  it("row gaps shrink then grow (log/power blend)", () => {
    const gaps: number[] = [];
    for (let d = 0; d < D; d++) gaps.push(s.y(d) - s.y(d + 1));
    const min = gaps.indexOf(Math.min(...gaps));
    expect(min).toBeGreaterThan(0);
    expect(min).toBeLessThan(D - 1);
    expect(gaps[0]).toBeGreaterThan(gaps[min]);
    expect(gaps[D - 1]).toBeGreaterThan(gaps[min]);
  });
  it("tolerates a zero depth cap", () => {
    const z = makeRowScale(0, 10, 100);
    expect(Number.isFinite(z.y(0))).toBe(true);
  });
});

describe("moveTicks", () => {
  const s = makeRowScale(100, 16, 400);
  it("starts with 'now' and uses absolute move numbers", () => {
    const t = moveTicks(0, s, 0);
    expect(t[0]).toEqual({ depth: 0, label: "now" });
    expect(t[1]).toEqual({ depth: 1, label: "1" });
    expect(t.find((x) => x.label === "2")?.depth).toBe(3);
    expect(t.find((x) => x.label === "10")?.depth).toBe(19);
  });
  it("offsets by the root ply", () => {
    const t = moveTicks(4, s, 0); // after 2.xx: White's move 3 is the next ply
    expect(t.find((x) => x.label === "3")?.depth).toBe(1);
    expect(t.find((x) => x.label === "1")).toBeUndefined();
  });
  it("drops ticks closer than the minimum gap", () => {
    const all = moveTicks(0, s, 0);
    const some = moveTicks(0, s, 30);
    expect(some.length).toBeLessThan(all.length);
    for (let i = 1; i < some.length; i++) {
      expect(Math.abs(s.y(some[i - 1].depth) - s.y(some[i].depth))).toBeGreaterThanOrEqual(30);
    }
  });
});
