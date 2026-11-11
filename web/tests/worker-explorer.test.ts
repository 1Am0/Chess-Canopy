import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import * as Comlink from "comlink";
import { createWorkerExplorer, ExplorerRestartError, type WorkerLike } from "@/lib/worker-explorer";
import { getExplorer, isExplorerRestart, onExplorerRestart, setExplorerSpawnForTests } from "@/lib/explorer-client";

/** A fake worker: Comlink endpoint backed by a MessageChannel, plus manual error events. */
function fakeWorker(impl: object) {
  const { port1, port2 } = new MessageChannel();
  Comlink.expose(impl, port2 as unknown as Comlink.Endpoint);
  const errors = new EventTarget();
  let terminated = false;
  const w: WorkerLike & { crash(msg?: string): void; fire(type: string): void; terminated: () => boolean } = {
    postMessage: (m: unknown, t?: Transferable[]) => port1.postMessage(m, t as never),
    addEventListener: ((type: string, l: EventListener) => {
      if (type === "message") port1.addEventListener("message", l as never);
      else errors.addEventListener(type, l);
    }) as WorkerLike["addEventListener"],
    removeEventListener: ((type: string, l: EventListener) => {
      if (type === "message") port1.removeEventListener("message", l as never);
      else errors.removeEventListener(type, l);
    }) as WorkerLike["removeEventListener"],
    start: () => port1.start(),
    terminate: () => {
      terminated = true;
      port1.close();
      port2.close();
    },
    crash: (msg = "out of memory") => errors.dispatchEvent(Object.assign(new Event("error"), { message: msg })),
    fire: (type: string) => errors.dispatchEvent(new Event(type)),
    terminated: () => terminated,
  };
  return w;
}

const never = () => new Promise<never>(() => {});
const api = (o: Record<string, unknown> = {}) => ({ listPlayers: async () => [], query: never, setSelection: never, ...o });

afterEach(() => setExplorerSpawnForTests(undefined));

describe("worker crash handling", () => {
  it("rejects pending and later calls, terminates the worker and reports once", async () => {
    const w = fakeWorker(api());
    let crashes = 0;
    const ex = createWorkerExplorer({ spawn: () => w, onCrash: () => crashes++ });
    expect(await ex.listPlayers()).toEqual([]);
    const pending = ex.query(["e4"]);
    const pending2 = ex.setSelection("all", {});
    w.crash();
    await expect(pending).rejects.toBeInstanceOf(ExplorerRestartError);
    await expect(pending2).rejects.toThrow(/stopped unexpectedly \(out of memory\)/);
    await expect(ex.listPlayers()).rejects.toBeInstanceOf(ExplorerRestartError);
    w.crash();
    w.fire("messageerror");
    expect(crashes).toBe(1);
    expect(w.terminated()).toBe(true);
  });

  it("getExplorer respawns after a crash and notifies restart listeners", async () => {
    const workers: ReturnType<typeof fakeWorker>[] = [];
    setExplorerSpawnForTests(() => {
      const n = workers.length;
      const w = fakeWorker(api({ listPlayers: async () => [{ id: `w${n}` }] }));
      workers.push(w);
      return w;
    });
    let restarts = 0;
    const off = onExplorerRestart(() => restarts++);
    try {
      const first = getExplorer();
      expect(getExplorer()).toBe(first);
      const p = first.query([]);
      workers[0].crash();
      const err = await p.catch((e) => e);
      expect(isExplorerRestart(err)).toBe(true);
      expect(restarts).toBe(1);
      const second = getExplorer();
      expect(second).not.toBe(first);
      expect(await second.listPlayers()).toEqual([{ id: "w1" }]);
      // a messageerror is treated as a crash too
      workers[1].fire("messageerror");
      expect(restarts).toBe(2);
      expect(getExplorer()).not.toBe(second);
    } finally {
      off();
      for (const w of workers) w.terminate();
    }
  });
});
