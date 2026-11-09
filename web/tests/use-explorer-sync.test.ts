// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { QueryResult, SelectionSummary } from "@/lib/engine/types";

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void };
const deferred = <T,>(): Deferred<T> => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

const calls = { setSelection: [] as Array<{ filters: unknown; d: Deferred<SelectionSummary> }>, query: [] as string[][] };
const fake = {
  listPlayers: vi.fn(async () => [{ id: "json:hero", source: "json", username: "hero", displayName: "hero", gameCount: 2, lastSyncedAt: null }]),
  setSelection: vi.fn((_ids: unknown, filters: unknown) => {
    const d = deferred<SelectionSummary>();
    calls.setSelection.push({ filters, d });
    return d.promise;
  }),
  query: vi.fn(async (path: string[]) => {
    calls.query.push(path);
    return { player: "all", games: 2, path, fen: "", stats: { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0, drawRate: 0, lossRate: 0 }, next: [] } as QueryResult;
  }),
};
vi.mock("@/lib/explorer-client", () => ({
  getExplorer: () => fake,
  onExplorerRestart: () => () => {},
  isExplorerRestart: () => false,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

const { useExplorerSync } = await import("@/hooks/use-explorer-sync");
const { useExplorerStore } = await import("@/lib/store");

const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));
const sum = (white: number, black: number): SelectionSummary => ({ games: white, counts: { white, black } });

let root: Root;
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  calls.setSelection = [];
  calls.query = [];
  useExplorerStore.setState({
    ready: false, players: [], path: [], cursor: 0, filters: { color: "white" }, sideChosen: false, selectionVersion: 0, summary: null, result: null,
  });
  const el = document.createElement("div");
  root = createRoot(el);
  function Probe() {
    useExplorerSync();
    return null;
  }
  await act(async () => root.render(createElement(Probe)));
  await wait(20);
});
afterEach(async () => {
  await act(async () => root.unmount());
});

describe("useExplorerSync", () => {
  it("auto-picks Black for a Black-only player (C12)", async () => {
    await wait(220);
    expect(calls.setSelection).toHaveLength(1);
    await act(async () => calls.setSelection[0].d.resolve(sum(0, 2)));
    expect(useExplorerStore.getState().filters.color).toBe("black");
    expect(useExplorerStore.getState().orientation).toBe("black");
    await wait(220);
    expect(calls.setSelection).toHaveLength(2);
    expect(calls.setSelection[1].filters).toMatchObject({ color: "black" });
  });

  it("ignores a stale setSelection and waits for the pending one before querying (C8)", async () => {
    await wait(220);
    await act(async () => calls.setSelection[0].d.resolve(sum(3, 1)));
    await wait(10);
    expect(calls.query).toEqual([[]]);

    // Filter change A, then B before A answers; the user moves meanwhile.
    await act(async () => useExplorerStore.getState().setFilters({ result: "1-0" }));
    await wait(220);
    await act(async () => useExplorerStore.getState().setFilters({ result: "0-1" }));
    await act(async () => useExplorerStore.getState().playMove("e4"));
    await wait(220);
    expect(calls.setSelection).toHaveLength(3);
    expect(calls.query).toEqual([[]]); // no query against the old selection

    await act(async () => calls.setSelection[2].d.resolve(sum(1, 0))); // B
    await wait(10);
    await act(async () => calls.setSelection[1].d.resolve(sum(9, 9))); // stale A arrives late
    await wait(10);
    expect(useExplorerStore.getState().summary).toEqual(sum(1, 0));
    expect(calls.query).toEqual([[], ["e4"]]);
  });
});
