import { describe, expect, it } from "vitest";
import { canopyBox, layoutCanopy } from "@/lib/canopy/layout";
import { lineText, moveLabel, placeLabels, relPath, type PlacedLabel } from "@/lib/canopy/labels";
import { syntheticSpec, treeFromSpec } from "@/lib/canopy/fixtures";
import { IDENTITY } from "@/lib/canopy/viewport";
import { pathIds } from "@/lib/canopy/subtree";

const measure = (s: string) => s.length * 6.6;
const box = { width: 700, height: 500 };
const lbox = canopyBox(box.width, box.height);

const overlap = (a: PlacedLabel, b: PlacedLabel) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe("moveLabel", () => {
  it("numbers White and Black moves", () => {
    expect(moveLabel(0, "e4")).toBe("1.e4");
    expect(moveLabel(1, "c5")).toBe("1…c5");
    expect(moveLabel(10, "Re1")).toBe("6.Re1");
    expect(moveLabel(11, "b5")).toBe("6…b5");
  });
});

describe("lineText / relPath", () => {
  const t = treeFromSpec(
    { kids: [{ san: "Nf3", kids: [{ san: "Nc6", kids: [{ san: "Bb5", kids: [{ san: "a6", w: 2 }, { san: "Nf6", w: 1 }] }] }] }] },
    { path: ["e4", "e5"] },
  );
  it("uses absolute numbering from a mid-game root", () => {
    const a6 = t.san.indexOf("a6");
    expect(relPath(t, a6)).toEqual(["Nf3", "Nc6", "Bb5", "a6"]);
    expect(lineText(t, a6)).toBe("2.Nf3 Nc6 3.Bb5 a6");
    expect(lineText(t, a6, 3)).toBe("…Nc6 3.Bb5 a6".replace("…Nc6", "…2…Nc6"));
    expect(lineText(t, 0)).toBe("");
  });
  it("starts on Black's move with an ellipsis number", () => {
    const t2 = treeFromSpec({ kids: [{ san: "e5", kids: [{ san: "Nf3", w: 2 }] }] }, { path: ["e4"] });
    expect(lineText(t2, 2)).toBe("1…e5 2.Nf3");
  });
  it("stops at the parent for a provisional leaf", () => {
    const t3 = treeFromSpec({ kids: [{ san: "e4", kids: [{ san: "", w: 1 }, { san: "", l: 1 }] }] });
    const i = t3.n - 1;
    expect(relPath(t3, i)).toEqual(["e4"]);
  });
});

describe("placeLabels", () => {
  const t = treeFromSpec(syntheticSpec(1200, 4));
  const l = layoutCanopy(t, lbox);
  it("never intersects two labels and respects the cap", () => {
    const labels = placeLabels(t, l, IDENTITY, box, measure);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThanOrEqual(Math.min(60, Math.floor((700 * 500) / 9000)));
    for (let a = 0; a < labels.length; a++) {
      for (let b = a + 1; b < labels.length; b++) expect(overlap(labels[a], labels[b])).toBe(false);
    }
    const few = placeLabels(t, l, IDENTITY, box, measure, { max: 3 });
    expect(few.length).toBeLessThanOrEqual(3);
  });
  it("keeps labels out of the gutter and inside the box", () => {
    for (const lb of placeLabels(t, l, IDENTITY, box, measure)) {
      expect(lb.x).toBeGreaterThanOrEqual(36);
      expect(lb.x + lb.w).toBeLessThanOrEqual(box.width);
      expect(lb.y).toBeGreaterThanOrEqual(0);
      expect(lb.y + lb.h).toBeLessThanOrEqual(box.height);
    }
  });
  it("labels the popular first moves and never leaves", () => {
    const labels = placeLabels(t, l, IDENTITY, box, measure);
    for (const lb of labels) expect([1, 2]).toContain(t.kind[lb.i]);
    expect(labels.some((lb) => t.depth[lb.i] === 1)).toBe(true);
  });
  it("places the hot path first", () => {
    const deepest = Array.from({ length: t.n }, (_, i) => i).filter((i) => t.kind[i] === 1).sort((a, b) => t.depth[b] - t.depth[a])[0];
    const hot = pathIds(t, deepest);
    const labels = placeLabels(t, l, IDENTITY, box, measure, { hot });
    const onPath = labels.filter((lb) => hot.includes(lb.i));
    expect(onPath.length).toBeGreaterThan(0);
    expect(labels.slice(0, onPath.length).every((lb) => hot.includes(lb.i))).toBe(true);
  });
});
