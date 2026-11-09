"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { lookupOpening } from "@/lib/openings/lookup";
import { splitOpeningName } from "@/lib/format";
import { usePosition } from "@/hooks/use-position";

export function OpeningHeader() {
  const { visible } = usePosition();
  const opening = useMemo(() => lookupOpening(visible), [visible]);
  const crumbs = opening ? splitOpeningName(opening.name) : [];

  return (
    <div className="flex min-h-8 items-center gap-2.5" aria-live="polite">
      {opening ? (
        <>
          <Badge variant="secondary" className="font-mono">
            {opening.eco}
          </Badge>
          <nav aria-label="Opening" className="min-w-0">
            <ol className="flex flex-wrap items-center gap-x-0.5 text-sm">
              {crumbs.map((c, i) => (
                <li key={i} className="flex items-center gap-0.5">
                  {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />}
                  <span className={i === crumbs.length - 1 ? "font-semibold" : "text-muted-foreground"}>{c}</span>
                </li>
              ))}
            </ol>
          </nav>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">
          {visible.length === 0 ? "Starting position" : "Out of book"}
        </span>
      )}
    </div>
  );
}
