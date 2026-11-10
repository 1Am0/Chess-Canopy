import { describe, expect, it } from "vitest";
import { canopyBox, layoutCanopy } from "@/lib/canopy/layout";
import { fakeContext, syntheticSpec, treeFromSpec } from "@/lib/canopy/fixtures";
import { CANOPY_STYLE, renderOverlay, renderStatic, type Frame } from "@/lib/canopy/render";
import { placeLabels } from "@/lib/canopy/labels";
import { makeRamp } from "@/lib/canopy/color";
import { pathIds } from "@/lib/canopy/subtree";
import type { CanopyTheme } from "@/lib/canopy/theme";
import { IDENTITY } from "@/lib/canopy/viewport";

const theme: CanopyTheme = {
  surface: "#fff", fg: "#111", muted: "#777", guide: "rgba(0,0,0,0.1)", branch: "#888", hot: "#e80", ring: "#0a5",
  line: "#063", ramp: makeRamp([180, 40, 30], [160, 150, 130], [30, 130, 70]), hazeAlpha: 0.1, leafAlpha: 0.9,
  tailAlpha: 0.28, mono: "mono", sans: "sans", dark: false, border: "#ccc",
};
const measure = (s: string) => s.length * 6.6;
const size = { width: 700, height: 500 };

function frame(spec: Parameters<typeof treeFromSpec>[0], view = IDENTITY, dpr = 2): Frame {
  const tree = treeFromSpec(spec);
  const layout = layoutCanopy(tree, canopyBox(size.width, size.height));
  const labels = placeLabels(tree, layout, view, size, measure);
  return { tree, layout, view, theme, dpr, box: size, labels };
}
const nums = (calls: ReturnType<typeof fakeContext>["calls"]) =>
  calls.flatMap((c) => c.args).filter((a): a is number => typeof a === "number");

describe("renderStatic", () => {
  const f = frame(syntheticSpec(1200, 2));
  it("draws without throwing and without NaN coordinates", () => {
    const { ctx, calls } = fakeContext();
    expect(() => renderStatic(ctx, f)).not.toThrow();
    expect(calls.length).toBeGreaterThan(50);
    for (const v of nums(calls)) expect(Number.isFinite(v)).toBe(true);
  });
  it("bounds stroke and fill calls by the node count", () => {
    const { ctx, count } = fakeContext();
    renderStatic(ctx, f);
    expect(count("stroke")).toBeLessThanOrEqual(f.tree.n + 100);
    expect(count("fill")).toBeLessThanOrEqual(f.tree.n + 100);
    expect(count("fillText")).toBeGreaterThanOrEqual(f.labels.length);
    expect(count("strokeText")).toBe(f.labels.length);
  });
  it("draws labels after a screen-space reset (crisp text)", () => {
    const { ctx, calls } = fakeContext();
    renderStatic(ctx, f);
    const firstLabel = calls.findIndex((c) => c.op === "strokeText");
    const reset = calls.slice(0, firstLabel).map((c, i) => [c, i] as const).filter(([c]) => c.op === "setTransform").pop();
    expect(reset?.[0].args).toEqual([2, 0, 0, 2, 0, 0]);
  });
  it("draws in the dpr*k world transform when zoomed", () => {
    const view = { k: 4, tx: -900, ty: -700 };
    const z = frame(syntheticSpec(300, 2), view);
    const { ctx, calls } = fakeContext();
    expect(() => renderStatic(ctx, z)).not.toThrow();
    const t = calls.find((c) => c.op === "setTransform" && c.args[0] === 2 * 4);
    expect(t?.args).toEqual([8, 0, 0, 8, -1800, -1400]);
    for (const v of nums(calls)) expect(Number.isFinite(v)).toBe(true);
  });
  it("renders a tree with only a root", () => {
    const e = frame({});
    const { ctx } = fakeContext();
    expect(() => renderStatic(ctx, e)).not.toThrow();
  });
});

describe("renderOverlay", () => {
  const f = frame(syntheticSpec(400, 6));
  const leaf = f.tree.kind.findIndex((k, i) => i > 0 && k === 3);
  it("blits the base at alpha 1 - 0.55 * dim", () => {
    const { ctx, calls } = fakeContext();
    const base = {} as CanvasImageSource;
    renderOverlay(ctx, f, { hot: -1, focus: -1, line: [], dim: 1, base }, measure);
    const blit = calls.find((c) => c.op === "drawImage");
    expect(blit?.alpha).toBeCloseTo(0.45, 9);
    const half = fakeContext();
    renderOverlay(half.ctx, f, { hot: -1, focus: -1, line: [], dim: 0, base }, measure);
    expect(half.calls.find((c) => c.op === "drawImage")?.alpha).toBe(1);
    expect(CANOPY_STYLE.dimAlpha).toBe(0.55);
  });
  it("draws the hover path, ring and path labels", () => {
    const { ctx, calls, count } = fakeContext();
    const hot = pathIds(f.tree, f.tree.parent[leaf]).slice(-1)[0];
    renderOverlay(ctx, f, { hot: leaf, focus: -1, line: [], dim: 1, base: {} as CanvasImageSource }, measure);
    expect(count("bezierCurveTo")).toBeGreaterThan(0);
    expect(count("arc")).toBeGreaterThanOrEqual(1);
    expect(hot).toBeGreaterThanOrEqual(0);
    for (const v of nums(calls)) expect(Number.isFinite(v)).toBe(true);
  });
  it("draws the focus ring and the current line", () => {
    const { ctx, count } = fakeContext();
    const line = pathIds(f.tree, f.tree.firstChild[f.tree.firstChild[0]]);
    renderOverlay(ctx, f, { hot: -1, focus: line[line.length - 1], line, dim: 0.5 }, measure);
    expect(count("arc")).toBe(2);
    expect(count("drawImage")).toBe(0);
  });
});

describe("performance smoke", () => {
  it("lays out and renders ~6k nodes quickly", () => {
    const tree = treeFromSpec(syntheticSpec(3200, 11));
    expect(tree.n).toBeGreaterThan(4000);
    const run = () => {
      const t0 = performance.now();
      const layout = layoutCanopy(tree, canopyBox(700, 500));
      const labels = placeLabels(tree, layout, IDENTITY, size, measure);
      const { ctx } = fakeContext();
      renderStatic(ctx, { tree, layout, view: IDENTITY, theme, dpr: 2, box: size, labels });
      return performance.now() - t0;
    };
    run(); // warm up
    expect(Math.min(run(), run())).toBeLessThan(30 * 4); // generous: the recording context allocates
  });
});
