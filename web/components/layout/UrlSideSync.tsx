"use client";

import { useEffect } from "react";
import { useExplorerStore } from "@/lib/store";

/**
 * Keeps the viewed side in the address bar next to `?line=` (replaceState), so a copied
 * address-bar URL opens on the same side. Only a side the user chose is written: an
 * automatically picked side is a default, and reading it back would make it permanent.
 */
export function UrlSideSync() {
  const ready = useExplorerStore((s) => s.ready);
  const explicit = useExplorerStore((s) => s.sideExplicit);
  const side = useExplorerStore((s) => s.filters.color ?? "white");

  useEffect(() => {
    if (!ready || !explicit) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("side") === side) return;
      url.searchParams.set("side", side);
      window.history.replaceState(null, "", url.pathname + url.search.replace(/%2C/gi, ",") + url.hash);
    } catch {
      /* ignore */
    }
  }, [ready, explicit, side]);

  return null;
}
