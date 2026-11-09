import { describe, expect, it } from "vitest";
import { formatEval, parseCloudEval, whiteShare } from "@/lib/cloud-eval";

describe("cloud eval", () => {
  it("parses cp and mate scores", () => {
    expect(parseCloudEval({ depth: 70, pvs: [{ moves: "e7e5", cp: 18 }] })).toEqual({ cp: 18, mate: null, depth: 70 });
    expect(parseCloudEval({ depth: 30, pvs: [{ moves: "a", mate: -3 }] })).toEqual({ cp: null, mate: -3, depth: 30 });
    expect(parseCloudEval({ pvs: [] })).toBeNull();
    expect(parseCloudEval(null)).toBeNull();
  });
  it("maps scores to a bar share", () => {
    expect(whiteShare({ cp: 0, mate: null, depth: 1 })).toBeCloseTo(50);
    expect(whiteShare({ cp: 300, mate: null, depth: 1 })).toBeGreaterThan(65);
    expect(whiteShare({ cp: -300, mate: null, depth: 1 })).toBeLessThan(35);
    expect(whiteShare({ cp: null, mate: 2, depth: 1 })).toBe(100);
    expect(whiteShare({ cp: null, mate: -2, depth: 1 })).toBe(0);
  });
  it("formats", () => {
    expect(formatEval({ cp: 18, mate: null, depth: 1 })).toBe("+0.2");
    expect(formatEval({ cp: -120, mate: null, depth: 1 })).toBe("-1.2");
    expect(formatEval({ cp: null, mate: -3, depth: 1 })).toBe("-M3");
    expect(formatEval({ cp: null, mate: 4, depth: 1 })).toBe("M4");
  });
});
