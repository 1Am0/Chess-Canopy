"use client";

import { useEffect, useState } from "react";
import type { GameSummary } from "@/lib/engine/types";
import type { CanopyTree } from "@/lib/canopy/types";
import { getExplorer } from "@/lib/explorer-client";

const cache = new Map<string, GameSummary | null>();

/**
 * The game behind a single-game leaf. The worker answers only for the canopy it built last, so
 * after a local re-root (no fetch happened) it is asked to re-register this root first.
 */
export async function fetchLeafGame(tree: CanopyTree, leafRef: number): Promise<GameSummary | null> {
  const k = `${tree.key}#${leafRef}`;
  if (cache.has(k)) return cache.get(k) ?? null;
  const api = getExplorer();
  if (!api.canopyGame) return null;
  let g = await api.canopyGame(tree.key, leafRef);
  if (!g && api.canopy) {
    await api.canopy({ path: tree.path, budgetMs: 0 });
    g = await api.canopyGame(tree.key, leafRef);
  }
  if (g) {
    if (cache.size > 200) cache.clear();
    cache.set(k, g);
  }
  return g;
}

export type LeafGameState = { status: "idle" } | { status: "loading" } | { status: "ready"; game: GameSummary | null };

/** Resolves the game for leaf `id` of `tree` (idle when `id` is not a leaf). */
export function useLeafGame(tree: CanopyTree | null, id: number): LeafGameState {
  const ref = tree && id >= 0 && id < tree.n && tree.kind[id] === 3 /* LEAF */ && tree.leafRef[id] >= 0 ? tree.leafRef[id] : -1;
  const [state, setState] = useState<{ k: string; game: GameSummary | null } | null>(null);
  const k = tree && ref >= 0 ? `${tree.key}#${ref}` : "";
  useEffect(() => {
    if (!tree || ref < 0) return;
    let live = true;
    const t = setTimeout(() => {
      fetchLeafGame(tree, ref).then(
        (game) => live && setState({ k, game }),
        () => live && setState({ k, game: null }),
      );
    }, 60); // hover passes over many leaves: only ask when the pointer rests
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  if (!k) return { status: "idle" };
  if (state?.k === k) return { status: "ready", game: state.game };
  return { status: "loading" };
}
