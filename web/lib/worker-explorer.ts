import * as Comlink from "comlink";
import type { ExplorerAPI, ImportProgress, ImportRequest } from "./engine/types";

/** Browser-only: spawns the explorer worker and returns a typed proxy. */
export function createWorkerExplorer(): ExplorerAPI {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    throw new Error("createWorkerExplorer can only be used in the browser");
  }
  const worker = new Worker(new URL("../workers/explorer.worker.ts", import.meta.url), { type: "module" });
  const remote = Comlink.wrap<ExplorerAPI>(worker);
  return {
    listPlayers: () => remote.listPlayers(),
    deletePlayer: (id) => remote.deletePlayer(id),
    exportPlayer: (id) => remote.exportPlayer(id),
    setSelection: (ids, f) => remote.setSelection(ids, f),
    query: (p) => remote.query(p),
    gamesAt: (p, l) => remote.gamesAt(p, l),
    opponents: () => remote.opponents(),
    importGames: (req: ImportRequest, cb: (p: ImportProgress) => void) => remote.importGames(req, Comlink.proxy(cb)),
    syncPlayer: (id: string, cb: (p: ImportProgress) => void) => remote.syncPlayer(id, Comlink.proxy(cb)),
    cancelImport: () => remote.cancelImport(),
  };
}
