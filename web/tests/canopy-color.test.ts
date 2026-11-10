import { describe, expect, it } from "vitest";
import { displayScore, makeRamp, oklabMix, rawScore, scoreT, toOklab, type Rgb } from "@/lib/canopy/color";
import { treeFromSpec } from "@/lib/canopy/fixtures";
import { CANOPY_VARS, cssAlpha, readCanopyTheme } from "@/lib/canopy/theme";

const parseRgb = (s: string): Rgb => {
  const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(s) as RegExpExecArray;
  return [+m[1], +m[2], +m[3]];
};

describe("ramp", () => {
  const low: Rgb = [200, 40, 30];
  const mid: Rgb = [170, 160, 140];
  const high: Rgb = [30, 140, 70];
  const ramp = makeRamp(low, mid, high);
  it("has 65 colors whose endpoints and middle equal the inputs", () => {
    expect(ramp).toHaveLength(65);
    expect(parseRgb(ramp[0])).toEqual(low);
    expect(parseRgb(ramp[32])).toEqual(mid);
    expect(parseRgb(ramp[64])).toEqual(high);
  });
  it("interpolates perceptually between the endpoints", () => {
    const m = oklabMix(low, high, 0.5);
    const L = [low, m, high].map((c) => toOklab(c)[0]);
    expect(L[1]).toBeGreaterThan(Math.min(L[0], L[2]));
    expect(L[1]).toBeLessThan(Math.max(L[0], L[2]));
  });
});

describe("scores", () => {
  it("scoreT maps 30/50/70 to 0/0.5/1 and clamps", () => {
    expect(scoreT(0.3)).toBeCloseTo(0, 9);
    expect(scoreT(0.5)).toBeCloseTo(0.5, 9);
    expect(scoreT(0.7)).toBeCloseTo(1, 9);
    expect(scoreT(-1)).toBe(0);
    expect(scoreT(2)).toBe(1);
  });
  it("shrinks small samples at a NODE, not at a LEAF", () => {
    const t = treeFromSpec({
      kids: [
        { san: "e4", kids: [{ san: "Nf6", w: 1 }, { san: "c5", w: 1 }] },
        { san: "d4", kids: [{ san: "d5", l: 1 }, { san: "e6", d: 1 }] },
      ],
    });
    const e4 = t.san.indexOf("e4");
    expect(t.kind[e4]).toBe(1);
    expect(displayScore(t, e4)).toBeCloseTo(0.75, 9); // (2 + 0 + 1) / (2 + 2)
    expect(rawScore(t, e4)).toBe(1);
    const single = treeFromSpec({ kids: [{ san: "a3", w: 1, kind: "node" }, { san: "b3", w: 1, kind: "node" }] });
    expect(single.kind[1]).toBe(1);
    expect(displayScore(single, 1)).toBeCloseTo(2 / 3, 9);
    expect(scoreT(displayScore(single, 1))).toBeLessThan(1);
    const leaf = t.san.indexOf("Nf6");
    expect(t.kind[leaf]).toBe(3);
    expect(displayScore(t, leaf)).toBe(1);
    expect(displayScore(t, t.san.indexOf("d5"))).toBe(0);
    expect(displayScore(t, t.san.indexOf("e6"))).toBe(0.5);
    expect(rawScore(t, 0)).toBeCloseTo(2.5 / 4, 9);
  });
});

describe("theme", () => {
  it("lists the canopy tokens", () => {
    for (const v of ["--canopy-branch", "--canopy-low", "--canopy-mid", "--canopy-high", "--canopy-guide"]) {
      expect(CANOPY_VARS).toContain(v);
    }
  });
  it("reads alpha from css strings", () => {
    expect(cssAlpha("oklch(0.95 0.03 140 / 11%)")).toBeCloseTo(0.11, 6);
    expect(cssAlpha("oklch(0.9 0.01 95)")).toBe(1);
    expect(cssAlpha("rgb(0 0 0 / 0.5)")).toBe(0.5);
  });
  it("builds a theme through the injected parser", () => {
    const values: Record<string, string> = {
      "--card": "#ffffff", "--foreground": "#000000", "--muted-foreground": "#777777", "--border": "rgb(204 204 204 / 50%)",
      "--canopy-branch": "#888888", "--canopy-low": "#c00000", "--canopy-mid": "#aaaaaa", "--canopy-high": "#007000",
      "--arrow-preview": "#ff9900", "--ring": "#00aa00", "--primary": "#006600",
    };
    const g = globalThis as unknown as { getComputedStyle?: unknown };
    const prev = g.getComputedStyle;
    g.getComputedStyle = () => ({ getPropertyValue: (n: string) => values[n] ?? "" });
    try {
      const el = { ownerDocument: { documentElement: { classList: { contains: (c: string) => c === "dark" } } } } as unknown as Element;
      const parse = (css: string): Rgb => {
        if (css.startsWith("rgb(")) return [204, 204, 204];
        const h = css.slice(1, 7);
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      };
      const th = readCanopyTheme(el, parse, { mono: "M", sans: "S" });
      expect(th.dark).toBe(true);
      expect(th.ramp).toHaveLength(65);
      expect(parseRgb(th.ramp[0])).toEqual([192, 0, 0]);
      expect(th.guide).toContain("0.35");
      expect(th.hazeAlpha).toBeGreaterThan(0.1);
      expect(th.mono).toBe("M");
    } finally {
      g.getComputedStyle = prev;
    }
  });
});
