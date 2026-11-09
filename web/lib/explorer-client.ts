import type { ExplorerAPI } from "@/lib/engine/types";
import { createWorkerExplorer } from "@/lib/worker-explorer";

let instance: ExplorerAPI | null = null;

/**
 * Single seam for all UI data access: a lazily created Comlink client for the
 * explorer Web Worker. Browser-only; the UI must never import the engine directly.
 * (The worker client proxies progress callbacks itself, so callers pass plain functions.)
 */
export function getExplorer(): ExplorerAPI {
  if (!instance) instance = createWorkerExplorer();
  return instance;
}
