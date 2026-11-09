"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { lookupOpening } from "@/lib/openings/lookup";
import { splitOpeningName } from "@/lib/format";
import { usePosition } from "@/hooks/use-position";
import { cn } from "@/lib/utils";

/** Fixed 28px, single line: ECO + opening breadcrumb, truncated (full name in the tooltip). */
export function OpeningHeader({ className }: { className?: string }) {
  const { visible } = usePosition();
  const opening = useMemo(() => lookupOpening(visible), [visible]);
  const crumbs = opening ? splitOpeningName(opening.name) : [];

  return (
    <div
      className={cn("flex h-7 min-w-0 shrink-0 items-center gap-2 overflow-hidden whitespace-nowrap", className)}
      aria-live="polite"
      title={opening ? `${opening.eco} ${opening.name}` : undefined}
    >
      {opening ? (
        <>
          <Badge variant="secondary" className="h-5 px-1.5 font-mono text-[11px] tabular-nums">
            {opening.eco}
          </Badge>
          <nav aria-label="Opening" className="min-w-0 flex-1">
            <ol className="truncate text-sm leading-7">
              {crumbs.map((c, i) => (
                <li key={i} className="inline">
                  {i > 0 && <ChevronRight className="mx-0.5 inline size-3.5 align-[-2px] text-muted-foreground" aria-hidden />}
                  <span className={i === crumbs.length - 1 ? "font-semibold" : "text-muted-foreground"}>{c}</span>
                </li>
              ))}
            </ol>
          </nav>
        </>
      ) : (
        <span className="truncate text-sm text-muted-foreground">{visible.length === 0 ? "Starting position" : "Out of book"}</span>
      )}
    </div>
  );
}
