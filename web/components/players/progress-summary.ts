import type { ImportProgress as Progress } from "@/lib/engine/types";

/** Percentage, headline and detail text for a progress event (null progress = starting). */
export function progressSummary(progress: Progress | null): { label: string; detail: string; pct: number | null } {
  if (!progress) return { label: "Starting…", detail: "", pct: null };
  const determinate = progress.total != null && progress.total > 0;
  const pct = determinate ? Math.min(100, Math.round((progress.done / (progress.total as number)) * 100)) : null;
  const label =
    progress.message ?? (progress.phase === "parsing" ? "Parsing games…" : progress.phase === "saving" ? "Saving…" : "Fetching games…");
  // While chess.com archives are being fetched only the month counts are known yet.
  const monthsOnly = progress.phase === "fetching" && determinate && progress.added === 0 && progress.duplicates === 0;
  const detail = monthsOnly
    ? `Month ${Math.min(progress.done + 1, progress.total as number)} of ${progress.total}`
    : `${progress.added.toLocaleString()} new · ${progress.duplicates.toLocaleString()} duplicates${pct != null ? ` · ${pct}%` : ""}`;
  return { label, detail, pct };
}
