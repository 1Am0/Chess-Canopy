import { beforeEach, describe, expect, it } from "vitest";
import { useExplorerStore } from "@/lib/store";
import { resetPositionCache } from "@/lib/position-cache";

const st = () => useExplorerStore.getState();

beforeEach(() => {
  resetPositionCache();
  useExplorerStore.setState({ path: [], cursor: 0, hoverMove: null, explorerView: "moves", canopyExpanded: false });
});

describe("playLine", () => {
  it("plays a relative line from the cursor", () => {
    st().playLine(["e4", "e5", "Nf3"]);
    expect(st().path).toEqual(["e4", "e5", "Nf3"]);
    expect(st().cursor).toBe(3);
  });
  it("keeps the redo branch when it already continues with the line", () => {
    st().setLine(["e4", "e5", "Nf3", "Nc6", "Bb5"]);
    st().goTo(1);
    st().playLine(["e5", "Nf3"]);
    expect(st().path).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5"]);
    expect(st().cursor).toBe(3);
  });
  it("replaces the branch when the line diverges", () => {
    st().setLine(["e4", "e5", "Nf3", "Nc6"]);
    st().goTo(1);
    st().playLine(["c5", "Nf3"]);
    expect(st().path).toEqual(["e4", "c5", "Nf3"]);
    expect(st().cursor).toBe(3);
  });
  it("plays only the legal prefix and ignores wholly illegal input", () => {
    st().playLine(["e4", "e5", "Qxh7"]);
    expect(st().path).toEqual(["e4", "e5"]);
    const before = st().path;
    st().playLine(["Qxh7"]);
    st().playLine([]);
    expect(st().path).toBe(before);
  });
});

describe("loadGame cursorAt", () => {
  const game = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"];
  it("keeps the cursor without cursorAt", () => {
    st().setLine(["e4", "e5"]);
    st().loadGame(game, "k:1");
    expect(st().cursor).toBe(2);
  });
  it("moves the cursor to cursorAt, clamped", () => {
    st().loadGame(game, "k:1", 4);
    expect(st().cursor).toBe(4);
    st().loadGame(game, "k:1", 99);
    expect(st().cursor).toBe(6);
    st().loadGame(game, "k:1", 0);
    expect(st().cursor).toBe(0);
  });
});

describe("canopy preferences", () => {
  it("persists canopyExpanded but not explorerView", () => {
    const opts = useExplorerStore.persist.getOptions();
    st().setExplorerView("canopy");
    st().setCanopyExpanded(true);
    const saved = opts.partialize!(st()) as Record<string, unknown>;
    expect(saved.canopyExpanded).toBe(true);
    expect("explorerView" in saved).toBe(false);
  });
  it("defaults to the moves tab, not expanded", () => {
    expect(useExplorerStore.getInitialState().explorerView).toBe("moves");
    expect(useExplorerStore.getInitialState().canopyExpanded).toBe(false);
  });
});
