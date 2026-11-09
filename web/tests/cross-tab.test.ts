import { describe, expect, it, vi } from "vitest";
import { broadcastDataChanged, onDataChanged } from "@/lib/cross-tab";
import { getExplorer, setExplorerSpawnForTests } from "@/lib/explorer-client";
import * as Comlink from "comlink";
import type { ExplorerAPI } from "@/lib/engine/types";

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));

describe("cross-tab sync (M12)", () => {
  it("tells other tabs about changes and hears theirs", async () => {
    const other = new BroadcastChannel("chess-canopy");
    const heard = vi.fn();
    other.onmessage = heard;
    const mine = vi.fn();
    const off = onDataChanged(mine);

    broadcastDataChanged();
    await wait();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(mine).not.toHaveBeenCalled(); // never hears itself

    other.postMessage({ type: "data-changed" });
    await wait();
    expect(mine).toHaveBeenCalledTimes(1);

    off();
    other.postMessage({ type: "data-changed" });
    await wait();
    expect(mine).toHaveBeenCalledTimes(1);
    other.close();
  });

  it("the explorer client broadcasts after import, sync and delete, even when they fail", async () => {
    const api: Partial<ExplorerAPI> = {
      deletePlayer: async () => {},
      importGames: async () => {
        throw new Error("boom");
      },
      syncPlayer: async () => ({ added: 0, total: 0, playerId: "x" }),
    };
    const { port1, port2 } = new MessageChannel();
    Comlink.expose(api, port1);
    setExplorerSpawnForTests(() => Object.assign(port2, { terminate() {} }) as never);
    const other = new BroadcastChannel("chess-canopy");
    const heard = vi.fn();
    other.onmessage = heard;
    const ex = getExplorer();
    await ex.deletePlayer("a");
    await expect(ex.importGames({ kind: "lichess", username: "u" }, () => {})).rejects.toThrow("boom");
    await ex.syncPlayer("a", () => {});
    await wait();
    expect(heard).toHaveBeenCalledTimes(3);
    other.close();
    setExplorerSpawnForTests(undefined);
    port1.close();
    port2.close();
  });
});
