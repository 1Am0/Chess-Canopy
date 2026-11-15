"use client";

import { splitOpeningName } from "@/lib/format";
import { statusOf } from "@/lib/repertoire/verdict";
import { PencilSlash } from "@/components/explorer/ink";
import { StringTag } from "@/components/paper";
import { useRepertoireData } from "@/components/repertoire/repertoire-data";
import { useOpening } from "@/components/repertoire/use-opening";
import { useHere } from "@/components/repertoire/here";
import { StatusChip } from "@/components/repertoire/VerdictChip";

/**
 * The explorer's OpeningHeader for the board position: fixed 28px, ECO + opening breadcrumb, truncated (full name in the
 * tooltip). At the right end, the status of the position when it is one of the report's.
 */
export function RepertoireOpening() {
  const { evals } = useRepertoireData();
  const { visible, point } = useHere();
  const opening = useOpening(visible);
  const crumbs = opening ? splitOpeningName(opening.name) : [];
  const status = point ? statusOf(point, evals.get(point.epd)) : null;

  return (
    <div
      className="flex h-7 min-w-0 shrink-0 items-center gap-2 overflow-hidden whitespace-nowrap"
      data-slot="opening-header"
      title={opening ? `${opening.eco} ${opening.name}` : undefined}
    >
      {opening ? (
        <>
          <StringTag>{opening.eco}</StringTag>
          <nav aria-label="Opening" className="min-w-0 flex-1">
            <ol key={opening.name} className="animate-in fade-in truncate text-base leading-7 text-ink duration-200 motion-reduce:animate-none">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <li key={i} className="inline">
                    {i > 0 && (
                      <span aria-hidden className="mx-1.5">
                        <PencilSlash seed={`${opening.eco}-${i}`} />
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
        <span className="min-w-0 flex-1 truncate font-serif text-base leading-7 text-pencil italic">{visible.length === 0 ? "Starting position" : "Out of book"}</span>
      )}
      {status && <StatusChip status={status} className="max-w-[50%] shrink-0" />}
    </div>
  );
}
