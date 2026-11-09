import type { ExplorerAPI } from "@/lib/engine/types";
import { broadcastDataChanged } from "@/lib/cross-tab";
import { createWorkerExplorer, ExplorerRestartError, type WorkerExplorerOptions } from "@/lib/worker-explorer";

let instance: ExplorerAPI | null = null;
const restartListeners = new Set<() => void>();
let spawnOverride: WorkerExplorerOptions["spawn"] | undefined;

/**
 * Single seam for all UI data access: a lazily created Comlink client for the
 * explorer Web Worker. Browser-only; the UI must never import the engine directly.
 * (The worker client proxies progress callbacks itself, so callers pass plain functions.)
 *
 * If the worker dies, every pending call rejects with ExplorerRestartError (callers
 * already toast thrown errors), the next call spawns a fresh worker, and restart
 * listeners run so the selection can be re-applied.
 */
export function getExplorer(): ExplorerAPI {
  if (!instance) {
    const raw = createWorkerExplorer({
      spawn: spawnOverride,
      onCrash: () => {
        if (instance === created) instance = null;
        for (const cb of [...restartListeners]) {
          try {
            cb();
          } catch {
            /* a listener must not break the others */
          }
        }
      },
    });
    const created = withBroadcast(raw);
    instance = created;
  }
  return instance;
}

/**
 * Operations that change stored data tell the other tabs afterwards (also after a failure
 * or cancel: a partial import may have saved games).
 */
function withBroadcast(api: ExplorerAPI): ExplorerAPI {
  const after = <T>(p: Promise<T>): Promise<T> => p.finally(broadcastDataChanged);
  return {
    ...api,
    deletePlayer: (id) => after(api.deletePlayer(id)),
    importGames: (req, cb) => after(api.importGames(req, cb)),
    syncPlayer: (id, cb) => after(api.syncPlayer(id, cb)),
  };
}

/** Subscribe to worker restarts; returns an unsubscribe function. */
export function onExplorerRestart(cb: () => void): () => void {
  restartListeners.add(cb);
  return () => {
    restartListeners.delete(cb);
  };
}

/** True for the error pending calls get when the worker died. */
export function isExplorerRestart(e: unknown): boolean {
  return e instanceof ExplorerRestartError || (e instanceof Error && e.name === "ExplorerRestartError");
}

/** Tests only: spawn workers with `spawn` and drop the current client. */
export function setExplorerSpawnForTests(spawn: WorkerExplorerOptions["spawn"] | undefined): void {
  spawnOverride = spawn;
  instance = null;
}
