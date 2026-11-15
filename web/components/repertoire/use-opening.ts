"use client";

import { useMemo, useSyncExternalStore } from "react";
import { lookupOpening, openingsVersion, subscribeOpenings, type OpeningMatch } from "@/lib/openings/lookup";

/** The opening of a line; re-computed when the (lazily loaded) opening names arrive, as usePosition does. */
export function useOpening(line: readonly string[]): OpeningMatch | null {
  const version = useSyncExternalStore(subscribeOpenings, openingsVersion, () => 0);
  return useMemo(() => {
    void version;
    return lookupOpening(line as string[]);
  }, [line, version]);
}
