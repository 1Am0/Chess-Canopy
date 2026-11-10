import { describe, expect, it } from "vitest";
import { findNode, pathIds, subtree } from "@/lib/canopy/subtree";
import { treeFromSpec } from "@/lib/canopy/fixtures";

const sub = {
  san: "e5",
  kids: [
    { san: "Nf3", kids: [{ san: "Nc6", w: 2, kids: [{ san: "Bb5", w: 1, leafLen: 12 }, { san: "Bc4", w: 1, leafLen: 9 }] }, { san: "d6", l: 1, leafLen: 8 }] },
    { san: "Bc4", d: 1, leafLen: 7 },
  ],
};
const full = { kids: [sub, { san: "c5", w: 1, leafLen: 6 }] };

describe("subtree", () => {
  const t = treeFromSpec(full, { path: ["e4"], key: "sel|white|e4", depthCap: 20 });
  it("findNode follows relative SANs", () => {
    expect(findNode(t, [])).toBe(0);
    expect(t.san[findNode(t, ["e5", "Nf3", "Nc6"])]).toBe("Nc6");
    expect(findNode(t, ["e5", "Qh5"])).toBe(-1);
    expect(findNode(t, ["Nf3"])).toBe(-1);
  });
  it("pathIds lists root..i", () => {
    const i = findNode(t, ["e5", "Nf3", "Nc6"]);
    expect(pathIds(t, i).map((id) => t.san[id])).toEqual(["", "e5", "Nf3", "Nc6"]);
  });
  it("equals a tree built directly from that root", () => {
    const i = findNode(t, ["e5", "Nf3"]);
    const got = subtree(t, i);
    const direct = treeFromSpec(
      { kids: (sub.kids[0].kids ?? []) },
      { path: ["e4", "e5", "Nf3"], key: "sel|white|e4 e5 Nf3", depthCap: 18 },
    );
    // The direct spec has a root without its own games; give it the same totals.
    for (const key of ["kind", "parent", "firstChild", "childCount", "depth", "branchDepth", "games", "wins", "draws", "losses", "ended", "leafLen"] as const) {
      expect(Array.from(got[key]), key).toEqual(Array.from(direct[key]));
    }
    expect(got.san).toEqual(direct.san);
    expect(got.path).toEqual(direct.path);
    expect(got.rootPly).toBe(3);
    expect(got.key).toBe("sel|white|e4 e5 Nf3");
    expect(got.depthCap).toBe(18);
    expect(got.rootStats.total).toBe(got.games[0]);
    expect(got.n).toBeLessThan(t.n);
  });
  it("returns the same tree for the root", () => {
    expect(subtree(t, 0)).toBe(t);
  });
});
