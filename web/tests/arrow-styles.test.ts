import { describe, expect, it } from "vitest";
import {
  arrowEnds,
  arrowShape,
  CHEVRON_HALF_ANGLE,
  hatchLines,
  LAYER_COUNT,
  levelForShare,
  START_GAP,
  STYLES,
  TIP_MARGIN,
  type ArrowStyleId,
} from "@/components/board/arrow-styles";

const IDS: ArrowStyleId[] = ["a", "b", "c", "d"];
const from = { x: 450, y: 650 };
const to = { x: 450, y: 450 };
const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);

describe("arrow ends", () => {
  it("starts out from the origin and stops short of the target centre by the margin", () => {
    const { start, tip } = arrowEnds(from, to);
    expect(dist(start, from)).toBeCloseTo(START_GAP, 5);
    expect(dist(tip, to)).toBeCloseTo(TIP_MARGIN, 5);
  });
  it("pulls the tip back further for converging arrows", () => {
    expect(dist(arrowEnds(from, to, 12).tip, to)).toBeCloseTo(TIP_MARGIN + 12, 5);
  });
  it("stays well-formed on the shortest move (adjacent squares) and on diagonals", () => {
    const e = arrowEnds({ x: 50, y: 50 }, { x: 150, y: 150 });
    expect(e.len).toBeGreaterThan(30);
    const short = arrowEnds({ x: 50, y: 50 }, { x: 150, y: 50 }, 18);
    expect(short.len).toBeGreaterThan(0);
    expect(short.tip.x).toBeGreaterThan(short.start.x);
  });
});

describe("shapes", () => {
  it("has a strictly decreasing width ladder and a head wider than the shaft", () => {
    for (const id of IDS) {
      const s = STYLES[id];
      expect(s.width[0]).toBeGreaterThan(s.width[1]);
      expect(s.width[1]).toBeGreaterThan(s.width[2]);
      expect(s.opacity[0]).toBeGreaterThan(s.opacity[2]);
    }
  });
  it("keeps head proportions per style and step", () => {
    for (const id of IDS) {
      for (const lv of [0, 1, 2] as const) {
        const sh = arrowShape({ style: id, from, to: { x: 450, y: 250 }, level: lv, kind: "candidate" });
        expect(sh.shaftWidth).toBe(STYLES[id].width[lv]);
        expect(sh.headLength).toBeGreaterThanOrEqual(23);
        expect(sh.headLength).toBeLessThanOrEqual(34);
        expect(sh.headBase).toBeGreaterThan(sh.shaftWidth * 1.9);
        expect(sh.headBase).toBeLessThan(sh.shaftWidth * 6.2);
      }
    }
  });
  it("draws the chevron at about 32 degrees", () => {
    expect((CHEVRON_HALF_ANGLE * 180) / Math.PI).toBeCloseTo(32, 5);
  });
  it("always returns the same number of layers, and is deterministic", () => {
    for (const id of IDS) {
      for (const kind of ["candidate", "hover", "user"] as const) {
        const a = arrowShape({ style: id, from, to, level: 1, kind });
        const b = arrowShape({ style: id, from, to, level: 1, kind });
        expect(a.layers).toHaveLength(LAYER_COUNT);
        expect(b).toEqual(a);
      }
    }
  });
  it("reports the tip where the margin says, for every style", () => {
    for (const id of IDS) {
      const sh = arrowShape({ style: id, from, to, level: 0, kind: "candidate" });
      expect(dist(sh.tip, to)).toBeCloseTo(TIP_MARGIN, 5);
    }
  });
  it("makes the hover preview look different from a candidate", () => {
    for (const id of IDS) {
      const c = arrowShape({ style: id, from, to, level: 0, kind: "candidate" });
      const h = arrowShape({ style: id, from, to, level: 0, kind: "hover" });
      expect(JSON.stringify(h.layers)).not.toEqual(JSON.stringify(c.layers));
    }
  });
  it("maps play share to the ladder", () => {
    expect([1, 0.7, 0.5, 0.2].map(levelForShare)).toEqual([0, 0, 1, 2]);
  });
});

describe("hatch", () => {
  it("stays inside the shaft rectangle at 45 degrees", () => {
    const lines = hatchLines(0, 120, 6, 5);
    expect(lines.length).toBeGreaterThan(15);
    for (const [p, q] of lines) {
      for (const pt of [p, q]) {
        expect(pt.x).toBeGreaterThanOrEqual(-1e-9);
        expect(pt.x).toBeLessThanOrEqual(120 + 1e-9);
        expect(Math.abs(pt.y)).toBeLessThanOrEqual(6 + 1e-9);
      }
      expect(Math.abs(q.x - p.x)).toBeCloseTo(Math.abs(q.y - p.y), 6);
    }
  });
});
