import * as Comlink from "comlink";
import type { ExplorerAPI, ImportOutcome, ImportProgress } from "../lib/engine/types";
import { canopyBuffers } from "../lib/engine/canopy-tree";
import { ExplorerService } from "../lib/explorer-service";

const svc = new ExplorerService();

/**
 * Progress callbacks arrive as Comlink proxies. Calls into them are fire-and-forget (a
 * closed page must not turn into an unhandled rejection here) and the proxy is released
 * when the import ends, so its MessagePort does not leak.
 */
async function withProgress(
  cb: (p: ImportProgress) => void,
  run: (onProgress: (p: ImportProgress) => void) => Promise<ImportOutcome>,
): Promise<ImportOutcome> {
  const safe = (p: ImportProgress) => {
    try {
      const r = cb(p) as unknown;
      if (r && typeof (r as Promise<unknown>).catch === "function") (r as Promise<unknown>).catch(() => {});
    } catch {
      /* the page went away */
    }
  };
  try {
    return await run(safe);
  } finally {
    try {
      (cb as unknown as Record<symbol, (() => void) | undefined>)[Comlink.releaseProxy]?.();
    } catch {
      /* not a proxy */
    }
  }
}

const api: ExplorerAPI = {
  listPlayers: () => svc.listPlayers(),
  deletePlayer: (id) => svc.deletePlayer(id),
  exportPlayer: (id) => svc.exportPlayer(id),
  setSelection: (ids, f) => svc.setSelection(ids, f),
  query: (p) => svc.query(p),
  gamesAt: (p, l, o) => svc.gamesAt(p, l, o),
  invalidate: () => svc.invalidate(),
  canopy: async (req) => {
    const t = await svc.canopy(req);
    return Comlink.transfer(t, canopyBuffers(t));
  },
  canopyGame: (key, ref) => svc.canopyGame(key, ref),
  opponents: () => svc.opponents(),
  importGames: (req, cb) => withProgress(cb, (p) => svc.importGames(req, p)),
  syncPlayer: (id, cb) => withProgress(cb, (p) => svc.syncPlayer(id, p)),
  cancelImport: () => svc.cancelImport(),
};

Comlink.expose(api);
