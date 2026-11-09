import * as Comlink from "comlink";
import type { ExplorerAPI, ImportProgress, ImportRequest } from "./engine/types";

/** The error every pending and later call gets once the worker has died. */
export class ExplorerRestartError extends Error {
  constructor(detail?: string) {
    super(`The explorer stopped unexpectedly${detail ? ` (${detail})` : ""}. It has been restarted; please try again.`);
    this.name = "ExplorerRestartError";
  }
}

/** What the client needs from a worker; a real `Worker` satisfies it. */
export type WorkerLike = Comlink.Endpoint & { terminate(): void };

export interface WorkerExplorerOptions {
  /** Called once when the worker dies (an `error` or `messageerror` event). */
  onCrash?: (err: ExplorerRestartError) => void;
  /** Injectable for tests; defaults to the bundled explorer worker. */
  spawn?: () => WorkerLike;
}

function spawnDefault(): WorkerLike {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    throw new Error("createWorkerExplorer can only be used in the browser");
  }
  return new Worker(new URL("../workers/explorer.worker.ts", import.meta.url), { type: "module" });
}

/**
 * Spawns the explorer worker and returns a typed proxy. Comlink promises never settle if the
 * worker dies (out of memory, an exception at module init), so the worker's `error` and
 * `messageerror` events reject every pending call with ExplorerRestartError, terminate the
 * worker and report the crash; the caller then creates a fresh client (explorer-client.ts).
 */
export function createWorkerExplorer(opts: WorkerExplorerOptions = {}): ExplorerAPI {
  const worker = (opts.spawn ?? spawnDefault)();
  const remote = Comlink.wrap<ExplorerAPI>(worker);
  const pending = new Set<(e: Error) => void>();
  let dead: ExplorerRestartError | null = null;

  const die = (detail?: string) => {
    if (dead) return;
    dead = new ExplorerRestartError(detail);
    for (const reject of pending) reject(dead);
    pending.clear();
    try {
      remote[Comlink.releaseProxy]();
    } catch {
      /* already gone */
    }
    try {
      worker.terminate();
    } catch {
      /* ignore */
    }
    opts.onCrash?.(dead);
  };
  worker.addEventListener("error", (ev: Event) => {
    ev.preventDefault?.();
    const msg = (ev as ErrorEvent).message;
    die(typeof msg === "string" && msg ? msg : undefined);
  });
  worker.addEventListener("messageerror", () => die("message error"));

  const call = <T>(fn: () => Promise<T>): Promise<T> => {
    if (dead) return Promise.reject(dead);
    return new Promise<T>((resolve, reject) => {
      pending.add(reject);
      fn().then(
        (v) => {
          pending.delete(reject);
          resolve(v);
        },
        (e) => {
          pending.delete(reject);
          reject(e);
        },
      );
    });
  };

  return {
    listPlayers: () => call(() => remote.listPlayers()),
    deletePlayer: (id) => call(() => remote.deletePlayer(id)),
    exportPlayer: (id) => call(() => remote.exportPlayer(id)),
    setSelection: (ids, f) => call(() => remote.setSelection(ids, f)),
    query: (p) => call(() => remote.query(p)),
    gamesAt: (p, l, o) => call(() => remote.gamesAt(p, l, o)),
    invalidate: () => call(() => (remote as unknown as { invalidate(): Promise<void> }).invalidate()),
    opponents: () => call(() => remote.opponents()),
    importGames: (req: ImportRequest, cb: (p: ImportProgress) => void) => call(() => remote.importGames(req, Comlink.proxy(cb))),
    syncPlayer: (id: string, cb: (p: ImportProgress) => void) => call(() => remote.syncPlayer(id, Comlink.proxy(cb))),
    cancelImport: () => call(() => remote.cancelImport()),
  };
}
