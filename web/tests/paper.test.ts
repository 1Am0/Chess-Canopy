import { describe, expect, it } from "vitest";
import {
  createRng,
  deckledPath,
  edgeProfile,
  fibreStrands,
  handArrow,
  hashSeed,
  inkArrowPath,
  inkCheckPath,
  inkEllipsePath,
  inkStrokePath,
  isWellFormedPath,
  pathPoints,
  pencilHatchSvg,
  speckPath,
  speckleMaskSvg,
  svgDataUri,
  tapePath,
  ticketPath,
  tornEdgeLine,
  tornStripPath,
  washPath,
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

describe("paper kit v2 generators", () => {
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

  it("washPath is closed and stays inside its box, with uneven ends", () => {
    const d = washPath(4, 120, 18);
    expect(isWellFormedPath(d)).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const b = bbox(d);
    expect(b.minX).toBeGreaterThanOrEqual(0);
    expect(b.maxX).toBeLessThanOrEqual(120);
    expect(b.minY).toBeGreaterThanOrEqual(0);
    expect(b.maxY).toBeLessThanOrEqual(18);
    const leftXs = pathPoints(d).filter((p) => p.x < 8).map((p) => p.x);
    expect(new Set(leftXs.map((x) => Math.round(x * 10))).size).toBeGreaterThan(1);
    expect(washPath(4, 120, 18)).toBe(d);
  });

  it("speckPath keeps every speck inside the tile and speckleMaskSvg wraps it", () => {
    const d = speckPath(8, 100, 40, 30);
    expect(isWellFormedPath(d)).toBe(true);
    const b = bbox(d);
    expect(b.minX).toBeGreaterThanOrEqual(0);
    expect(b.maxX).toBeLessThanOrEqual(100);
    expect(b.minY).toBeGreaterThanOrEqual(0);
    expect(b.maxY).toBeLessThanOrEqual(40);
    expect(speckleMaskSvg(8, 100, 40, 30)).toContain("evenodd");
  });

  it("ticketPath cuts both ends and stays inside its box for both styles", () => {
    for (const ends of ["perforated", "torn"] as const) {
      const d = ticketPath("t", 220, 44, { ends });
      expect(isWellFormedPath(d)).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
      const b = bbox(d);
      expect(b.minX).toBeGreaterThanOrEqual(0);
      expect(b.maxX).toBeLessThanOrEqual(220);
      expect(b.minY).toBeGreaterThanOrEqual(0);
      expect(b.maxY).toBeLessThanOrEqual(44);
      // notches/teeth reach inward on both ends
      expect(pathPoints(d).some((p) => p.x > 1 && p.x < 8)).toBe(true);
      expect(pathPoints(d).some((p) => p.x < 219 && p.x > 212)).toBe(true);
      expect(ticketPath("t", 220, 44, { ends })).toBe(d);
    }
    expect(isWellFormedPath(ticketPath(1, 20, 6))).toBe(true);
  });

  it("pencilHatchSvg gives a seamless-size tile and differs by seed", () => {
    const a = pencilHatchSvg(1, 5);
    expect(a.size).toBe(20);
    expect(a.svg).toContain("<path");
    expect(pencilHatchSvg(1, 5).svg).toBe(a.svg);
    expect(pencilHatchSvg(2, 5).svg).not.toBe(a.svg);
    expect(pencilHatchSvg(1, 5, -1).svg).not.toBe(a.svg);
  });

  it("inkCheckPath is a short well formed open path inside the 16px box", () => {
    const d = inkCheckPath("cb");
    expect(isWellFormedPath(d)).toBe(true);
    expect(inkCheckPath("cb")).toBe(d);
    const b = bbox(d);
    expect(b.minX).toBeGreaterThan(1);
    expect(b.maxX).toBeLessThan(15.5);
    expect(b.minY).toBeGreaterThan(1);
    expect(b.maxY).toBeLessThan(15);
  });
});
