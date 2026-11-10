// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CanopyRequest, CanopyTree } from "@/lib/canopy/types";
import { treeFromSpec, type TreeSpec } from "@/lib/canopy/fixtures";
import type { QueryResult } from "@/lib/engine/types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const api: { canopy?: (r: CanopyRequest) => Promise<CanopyTree> } = {};
vi.mock("@/lib/explorer-client", () => ({
  getExplorer: () => api,
  isExplorerRestart: () => false,
  onExplorerRestart: () => () => {},
}));

import { resetCanopyCache, useCanopy, type CanopyState } from "@/hooks/use-canopy";
import { useExplorerStore } from "@/lib/store";
import { resetPositionCache } from "@/lib/position-cache";

const SPEC: TreeSpec = {
  kids: [
    { san: "e4", kids: [{ san: "e5", w: 3, d: 1, l: 1 }, { san: "c5", w: 1, d: 0, l: 2 }] },
    { san: "d4", w: 1, d: 1, l: 1 },
  ],
};
const tree = (path: string[], complete = true) => treeFromSpec(path.length ? { kids: SPEC.kids![0].kids } : SPEC, { path, complete, key: `k|white|${path.join(" ")}` });

let latest: CanopyState;
function Probe({ active }: { active: boolean }) {
  latest = useCanopy(active);
  return null;
}

let root: Root | null = null;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const mount = async (active = true) => {
  root = createRoot(document.createElement("div"));
  await act(async () => root!.render(createElement(Probe, { active })));
  await flush();
};
const at = (path: string[], extra: Record<string, unknown> = {}) =>
  act(async () => {
    useExplorerStore.setState({
      path,
      cursor: path.length,
      result: { path, stats: { total: 1 } } as unknown as QueryResult,
      resultLoading: false,
      ...extra,
    });
  });

beforeEach(() => {
  resetCanopyCache();
  resetPositionCache();
  api.canopy = undefined;
  useExplorerStore.setState({ selectionVersion: 1, filters: { color: "white" }, path: [], cursor: 0, result: { path: [], stats: { total: 1 } } as unknown as QueryResult, resultLoading: false });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
});

describe("useCanopy", () => {
  it("waits for a fresh position result before asking the worker", async () => {
    const canopy = vi.fn(async (r: CanopyRequest) => tree(r.path));
    api.canopy = canopy;
    useExplorerStore.setState({ resultLoading: true });
    await mount();
    expect(canopy).not.toHaveBeenCalled();
    expect(latest.status).toBe("loading");
    await at([]);
    await flush();
    expect(canopy).toHaveBeenCalledTimes(1);
    expect(canopy.mock.calls[0][0]).toMatchObject({ path: [], budgetMs: 120 });
    expect(latest.status).toBe("ready");
    expect(latest.tree?.n).toBeGreaterThan(1);
  });

  it("does nothing while inactive or before the first selection", async () => {
    const canopy = vi.fn(async (r: CanopyRequest) => tree(r.path));
    api.canopy = canopy;
    await mount(false);
    expect(canopy).not.toHaveBeenCalled();
    expect(latest.tree).toBeNull();
  });

  it("re-roots locally inside a complete tree without another request", async () => {
    const canopy = vi.fn(async (r: CanopyRequest) => tree(r.path));
    api.canopy = canopy;
    await mount();
    expect(canopy).toHaveBeenCalledTimes(1);
    await at(["e4"], { result: { path: ["e4"], stats: { total: 1 } } as unknown as QueryResult });
    expect(latest.tree?.path).toEqual(["e4"]);
    expect(latest.stale).toBe(false);
    await flush();
    expect(canopy).toHaveBeenCalledTimes(1);
    expect(latest.status).toBe("ready");
  });

  it("re-roots locally and then refines an incomplete tree", async () => {
    const canopy = vi.fn(async (r: CanopyRequest) => tree(r.path, r.path.length > 0));
    api.canopy = canopy;
    await mount();
    canopy.mockClear();
    await at(["e4"]);
    expect(latest.tree?.path).toEqual(["e4"]);
    await flush();
    expect(canopy).toHaveBeenCalled();
    expect(canopy.mock.calls[0][0].path).toEqual(["e4"]);
  });

  it("drops a response that lost the seq race", async () => {
    const pending: Array<(t: CanopyTree) => void> = [];
    api.canopy = vi.fn((r: CanopyRequest) => new Promise<CanopyTree>((res) => pending.push((t) => res(t ?? tree(r.path)))));
    await mount();
    await at(["d4"]);
    await flush();
    expect(pending).toHaveLength(2);
    await act(async () => pending[1](tree(["d4"])));
    await act(async () => pending[0](tree([])));
    await flush();
    expect(latest.tree?.path).toEqual(["d4"]);
  });

  it("keeps refining until the tree is complete, then stops", async () => {
    let calls = 0;
    api.canopy = vi.fn(async (r: CanopyRequest) => tree(r.path, ++calls >= 3));
    await mount();
    await flush();
    await flush();
    expect(calls).toBe(3);
    expect(latest.status).toBe("ready");
    expect((api.canopy as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].budgetMs)).toEqual([120, 400, 400]);
  });

  it("clears the cache when the selection changes", async () => {
    const canopy = vi.fn(async (r: CanopyRequest) => tree(r.path));
    api.canopy = canopy;
    await mount();
    expect(canopy).toHaveBeenCalledTimes(1);
    await act(async () => useExplorerStore.setState({ selectionVersion: 2 }));
    await flush();
    expect(canopy).toHaveBeenCalledTimes(2);
    expect(latest.stale).toBe(false);
  });

  it("reports an error when the API has no canopy method", async () => {
    await mount();
    await flush();
    expect(latest.status).toBe("error");
  });

  it("ignores an invalid move sequence (the sync hook repairs the line)", async () => {
    api.canopy = vi.fn(async () => {
      throw new Error("Invalid move sequence");
    });
    await mount();
    await flush();
    expect(latest.status).not.toBe("error");
  });
});
