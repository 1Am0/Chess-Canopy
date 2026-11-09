"use client";

import { useExplorerStore } from "@/lib/store";
import { buildTrail } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Numbered PGN-style trail; moves beyond the cursor are the redo branch. */
export function MoveTrail() {
  const path = useExplorerStore((s) => s.path);
  const cursor = useExplorerStore((s) => s.cursor);
  const goTo = useExplorerStore((s) => s.goTo);
  const entries = buildTrail(path);

  if (entries.length === 0) {
    return <p className="px-1 text-sm text-muted-foreground">Play a move on the board or pick one from the table.</p>;
  }
  return (
    <nav aria-label="Move trail" className="flex flex-wrap items-center gap-x-0.5 gap-y-1 text-sm">
      {entries.map((e) => (
        <span key={e.index} className="inline-flex items-center">
          {e.number && <span className="mr-0.5 ml-1.5 font-mono text-xs text-muted-foreground tabular-nums">{e.number}</span>}
          <button
            type="button"
            onClick={() => goTo(e.index + 1)}
            aria-current={e.index === cursor - 1 ? "step" : undefined}
            className={cn(
              "rounded px-1.5 py-0.5 font-mono font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60",
              e.index === cursor - 1 && "bg-primary text-primary-foreground hover:bg-primary",
              e.index >= cursor && "text-muted-foreground/70",
            )}
          >
            {e.san}
          </button>
        </span>
      ))}
    </nav>
  );
}
