import { describe, expect, it } from "vitest";
import { IDENTITY, clampView, lerpView, panBy, revealNode, toScreen, toWorld, zoomAt } from "@/lib/canopy/viewport";
import { layoutCanopy, canopyBox } from "@/lib/canopy/layout";
import { treeFromSpec } from "@/lib/canopy/fixtures";

const box = { width: 600, height: 400 };

describe("viewport", () => {
  it("zoomAt keeps the point under the cursor fixed", () => {
    let v = IDENTITY;
    v = zoomAt(v, 2, 300, 200, box);
    const [wx, wy] = toWorld(v, 300, 200);
    expect(wx).toBeCloseTo(300, 6);
    expect(wy).toBeCloseTo(200, 6);
    const [w0x, w0y] = toWorld(v, 450, 120);
    const v2 = zoomAt(v, 1.5, 450, 120, box);
    const [sx, sy] = toScreen(v2, w0x, w0y);
    expect(sx).toBeCloseTo(450, 6);
    expect(sy).toBeCloseTo(120, 6);
  });
  it("clamps k to [1, 12] and keeps the content covering the box", () => {
    expect(clampView({ k: 0.2, tx: 50, ty: 50 }, box)).toEqual({ k: 1, tx: 0, ty: 0 });
    const big = clampView({ k: 99, tx: 10, ty: 10 }, box);
    expect(big.k).toBe(12);
    expect(big.tx).toBe(0);
    const far = clampView({ k: 4, tx: -99999, ty: -99999 }, box);
    expect(far.tx).toBe(box.width * (1 - 4));
    expect(far.ty).toBe(box.height * (1 - 4));
    let v = IDENTITY;
    for (let i = 0; i < 40; i++) v = zoomAt(v, 1.4, 599, 399, box);
    expect(v.k).toBe(12);
    expect(v.tx).toBeGreaterThanOrEqual(box.width * (1 - 12));
    expect(v.tx).toBeLessThanOrEqual(0);
  });
  it("panBy cannot leave the content", () => {
    const v = panBy({ k: 2, tx: -10, ty: -10 }, 500, 500, box);
    expect(v.tx).toBe(0);
    expect(v.ty).toBe(0);
    expect(panBy(IDENTITY, 30, 30, box)).toEqual(IDENTITY);
  });
  it("toWorld and toScreen round-trip", () => {
    const v = { k: 3.5, tx: -420, ty: -77 };
    const [sx, sy] = toScreen(v, 123.4, 56.7);
    const [wx, wy] = toWorld(v, sx, sy);
    expect(wx).toBeCloseTo(123.4, 9);
    expect(wy).toBeCloseTo(56.7, 9);
  });
  it("lerpView interpolates", () => {
    const m = lerpView(IDENTITY, { k: 3, tx: -100, ty: -40 }, 0.5);
    expect(m).toEqual({ k: 2, tx: -50, ty: -20 });
  });
  it("revealNode pans minimally to show a node", () => {
    const t = treeFromSpec({ kids: [{ san: "e4", kids: [{ san: "e5", w: 1 }, { san: "c5", w: 1 }] }, { san: "d4", w: 1, kids: [{ san: "d5", w: 1 }, { san: "Nf6", l: 1 }] }] });
    const l = layoutCanopy(t, canopyBox(box.width, box.height));
    const v0 = { k: 4, tx: 0, ty: 0 };
    const i = t.n - 1;
    const v1 = revealNode(v0, l, i, box, 20);
    const [sx, sy] = toScreen(v1, l.x[i], l.y[i]);
    expect(sx).toBeGreaterThanOrEqual(19.999);
    expect(sx).toBeLessThanOrEqual(box.width - 19.999);
    expect(sy).toBeGreaterThanOrEqual(19.999);
    expect(sy).toBeLessThanOrEqual(box.height - 19.999);
    expect(v1.k).toBe(4);
    const visible = revealNode(IDENTITY, l, 1, box, 4);
    expect(visible).toEqual(IDENTITY);
  });
});
