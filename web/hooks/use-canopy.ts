"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanopyTree } from "@/lib/canopy/types";
import { NODE } from "@/lib/canopy/types";
import { findNode, subtree } from "@/lib/canopy/subtree";
import { getExplorer, isExplorerRestart, onExplorerRestart } from "@/lib/explorer-client";
import { isResultFresh, useExplorerStore } from "@/lib/store";
import { usePosition } from "@/hooks/use-position";

export interface CanopyState {
  tree: CanopyTree | null;
  status: "idle" | "loading" | "refining" | "ready" | "error";
  /** The shown tree belongs to an earlier root / selection and a newer one is pending. */
  stale: boolean;
  error: string | null;
  retry: () => void;
}

/** First answer within ~120 ms of worker time; later rounds refine in the background. */
export const FIRST_BUDGET_MS = 120;
export const ROUND_BUDGET_MS = 400;
export const MAX_ROUNDS = 6;
/** The old tree is shown dimmed only when a new one is still missing after this long. */
export const STALE_DELAY_MS = 150;
const LRU_SIZE = 8;

/**
 * Client LRU of trees, shared by every canopy instance (compact panel, expanded column,
 * sheet), so switching between them paints instantly. It is dropped whenever the
 * selection (side, filters, players) changes.
 */
const lru = new Map<string, CanopyTree>();
let lruVersion = -1;

function lruSync(version: number) {
  if (lruVersion !== version) {
    lru.clear();
    lruVersion = version;
  }
}
function lruGet(key: string): CanopyTree | undefined {
  const t = lru.get(key);
  if (t) {
    lru.delete(key);
    lru.set(key, t);
  }
  return t;
}
function lruSet(key: string, t: CanopyTree) {
  lru.delete(key);
  lru.set(key, t);
  while (lru.size > LRU_SIZE) lru.delete(lru.keys().next().value as string);
}
/** Tests only. */
export function resetCanopyCache() {
  lru.clear();
  lruVersion = -1;
}

interface Held {
  tree: CanopyTree;
  /** `${selectionVersion}|${side}|${posKey}` this tree answers. */
  forKey: string;
  version: number;
  side: string;
}

/**
 * The canopy tree for the board position. Fetches only while `active`, and only after the
 * position query for the same key resolved (so arrows and the summary are never delayed).
 * A move that stays inside the shown tree re-roots it locally at once, then refines.
 */
export function useCanopy(active: boolean): CanopyState {
  const selectionVersion = useExplorerStore((s) => s.selectionVersion);
  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const fresh = useExplorerStore((s) => isResultFresh(s) && !s.resultLoading);
  const { key: posKey, visible } = usePosition();
  const wanted = `${selectionVersion}|${side}|${posKey}`;

  const [held, setHeld] = useState<Held | null>(null);
  const [status, setStatus] = useState<CanopyState["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [restarts, setRestarts] = useState(0);
  const [staleLate, setStaleLate] = useState(false);
  const seq = useRef(0);
  const heldRef = useRef<Held | null>(null);
  heldRef.current = held;

  useEffect(() => onExplorerRestart(() => setRestarts((n) => n + 1)), []);

  const isStaleNow = !!held && held.forKey !== wanted;
  useEffect(() => {
    if (!isStaleNow) {
      setStaleLate(false);
      return;
    }
    const t = setTimeout(() => setStaleLate(true), STALE_DELAY_MS);
    return () => clearTimeout(t);
  }, [isStaleNow, wanted]);

  useEffect(() => {
    if (!active || selectionVersion === 0) return;
    lruSync(selectionVersion);
    let cancelled = false;
    const mySeq = ++seq.current;
    const live = () => !cancelled && mySeq === seq.current;

    const put = (tree: CanopyTree) => {
      lruSet(wanted, tree);
      setHeld({ tree, forKey: wanted, version: selectionVersion, side });
    };

    let have: CanopyTree | null = null;
    const cached = lruGet(wanted);
    if (cached) {
      have = cached;
      put(cached);
    } else {
      // Local re-root: the new root is a node of the tree on screen.
      const h = heldRef.current;
      if (h && h.version === selectionVersion && h.side === side && h.tree.color === side) {
        const base = h.tree;
        const rootLen = base.path.length;
        if (visible.length >= rootLen && base.path.every((m, i) => m === visible[i])) {
          const id = findNode(base, visible.slice(rootLen));
          if (id >= 0 && base.kind[id] === NODE) {
            have = subtree(base, id);
            put(have);
          }
        }
      }
    }
    setError(null);
    if (have?.complete) {
      setStatus("ready");
      return () => {
        cancelled = true;
      };
    }
    setStatus(have ? "refining" : "loading");
    if (!fresh) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const api = getExplorer();
      if (typeof api.canopy !== "function") {
        setError("The canopy view is not available.");
        setStatus("error");
        return;
      }
      try {
        let budgetMs = FIRST_BUDGET_MS;
        for (let round = 0; round < MAX_ROUNDS + 1; round++) {
          const tree = await api.canopy({ path: visible, budgetMs, seq: mySeq });
          if (!live()) return;
          put(tree);
          if (tree.complete) {
            setStatus("ready");
            return;
          }
          setStatus("refining");
          budgetMs = ROUND_BUDGET_MS;
        }
        setStatus("ready");
      } catch (e) {
        if (!live()) return;
        if (isExplorerRestart(e)) return; // refetched on the restart tick
        if (e instanceof Error && e.message.includes("Invalid move sequence")) return; // the sync hook repairs the line
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // `visible` is determined by posKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, selectionVersion, side, posKey, fresh, attempt, restarts]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return {
    tree: held?.tree ?? null,
    status: active || held ? status : "idle",
    stale: isStaleNow && staleLate,
    error,
    retry,
  };
}
