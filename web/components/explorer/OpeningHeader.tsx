"use client";

import { useMemo } from "react";
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
      data-slot="opening-header"
      title={opening ? `${opening.eco} ${opening.name}` : undefined}
    >
      {opening ? (
        <>
          <span className="inline-flex h-5 shrink-0 items-center rounded-sm border border-rule-strong bg-specimen px-1.5 font-mono text-[11px] leading-none tracking-wide text-ink tabular-nums">
            {opening.eco}
          </span>
          <nav aria-label="Opening" className="min-w-0 flex-1">
            <ol key={opening.name} className="animate-in fade-in truncate text-base leading-7 text-ink duration-200 motion-reduce:animate-none">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <li key={i} className="inline">
                    {i > 0 && (
                      <span aria-hidden className="mx-1.5 font-sans text-sm text-muted-foreground/70">
                        /
                      </span>
                    )}
                    <span className={last ? "font-serif font-medium italic" : "font-sans text-sm text-muted-foreground"}>{c}</span>
                  </li>
                );
              })}
            </ol>
          </nav>
        </>
      ) : (
        <span className="truncate font-serif text-base leading-7 text-muted-foreground italic">{visible.length === 0 ? "Starting position" : "Out of book"}</span>
      )}
    </div>
  );
}
