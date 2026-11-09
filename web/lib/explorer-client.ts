import type { ExplorerAPI } from "@/lib/engine/types";
import { mockExplorer } from "@/lib/mock-explorer";

let instance: ExplorerAPI | null = null;

/**
 * Single seam for all UI data access. A later change replaces the body with a
 * Comlink-wrapped Web Worker; the UI must never import the engine directly.
 */
export function getExplorer(): ExplorerAPI {
  if (!instance) instance = mockExplorer;
  return instance;
}

/**
 * Wrap callbacks passed across the worker boundary. Becomes `Comlink.proxy(fn)`
 * once the worker is wired; identity for the in-memory mock.
 */
export function withProxy<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}
