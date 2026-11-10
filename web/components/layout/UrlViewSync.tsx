"use client";

import { useEffect } from "react";
import { useExplorerStore } from "@/lib/store";

/**
 * Keeps `?view=canopy` in the address bar (replaceState) next to `?line=` and `?side=`,
 * so a copied URL reopens on the Canopy tab. Moves and Games are the default: no param.
 */
export function UrlViewSync() {
  const ready = useExplorerStore((s) => s.ready);
  const view = useExplorerStore((s) => s.explorerView);

  useEffect(() => {
    if (!ready) return;
    try {
      const url = new URL(window.location.href);
      const has = url.searchParams.get("view");
      if (view === "canopy") {
        if (has === "canopy") return;
        url.searchParams.set("view", "canopy");
      } else {
        if (has === null) return;
        url.searchParams.delete("view");
      }
      window.history.replaceState(null, "", url.pathname + url.search.replace(/%2C/gi, ",") + url.hash);
    } catch {
      /* ignore */
    }
  }, [ready, view]);

  return null;
}
