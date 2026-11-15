"use client";

import { ExternalLink } from "lucide-react";
import { EmptySpecimen } from "@/components/field";
import { PaperSheet } from "@/components/paper";
import { Button } from "@/components/ui/button";
import { useRepertoirePage } from "@/lib/repertoire/page-store";
import { useRepertoireData } from "@/components/repertoire/repertoire-data";
import { useSelectPosition } from "@/components/repertoire/PointList";
import { lineTail, shortDate } from "@/components/repertoire/format";
import { HighlighterWash } from "@/components/paper";

const rowButton =
  "group/row relative isolate flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2 text-left outline-none hover:bg-specimen/60 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring";

function SectionHead({ id, title, count }: { id: string; title: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-rule-strong px-3 pt-3 pb-2">
      <h2 id={id} className="font-serif text-lg font-semibold text-ink">
        {title}
      </h2>
      {count != null && <span className="font-mono text-xs text-muted-foreground tabular-nums">{count}</span>}
    </div>
  );
}

/** Your saved moves on this side: the line, the move and Unlock; a click shows the position on the board. */
export function YourRepertoire() {
  const { entries, pointsByEpd, busy, unlock } = useRepertoireData();
  const selectedEpd = useRepertoirePage((s) => s.selectedEpd);
  const selectPosition = useSelectPosition();
  const sorted = [...entries].sort((a, b) => a.line.length - b.line.length || a.line.join(" ").localeCompare(b.line.join(" ")));

  return (
    <PaperSheet as="section" aria-labelledby="your-repertoire" className="min-w-0">
      <SectionHead id="your-repertoire" title="Your repertoire" count={entries.length} />
      {sorted.length === 0 ? (
        <EmptySpecimen title="No moves locked in yet" hint="Pick a position above and lock in the move you want to play there." />
      ) : (
        <ul>
          {sorted.map((e) => {
            const tail = lineTail(e.line);
            const reached = pointsByEpd.has(e.epd);
            return (
              <li key={e.id} className="flex items-center gap-2 border-b border-rule pr-3 last:border-b-0">
                <button type="button" className={rowButton} title={tail.full} aria-current={e.epd === selectedEpd ? "true" : undefined} onClick={() => selectPosition(e.epd, e.line)}>
                  {e.epd === selectedEpd && <HighlighterWash fill seed={e.id} />}
                  <span className="truncate font-mono text-xs text-muted-foreground">{tail.short}</span>
                  <span className="flex items-baseline gap-2 text-sm">
                    <span className="font-mono font-semibold text-ink">{e.san}</span>
                    {!reached && <span className="text-xs text-muted-foreground">Not in your games yet</span>}
                  </span>
                </button>
                <Button variant="outline" size="sm" className="max-sm:h-10" disabled={busy} onClick={() => void unlock(e.epd, e.san)} aria-label={`Unlock ${e.san}`}>
                  Unlock
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </PaperSheet>
  );
}

/** Games since a move was locked in where you played something else. */
export function LeftRepertoire() {
  const { report } = useRepertoireData();
  const list = report?.deviations ?? [];
  return (
    <PaperSheet as="section" aria-labelledby="left-repertoire" className="min-w-0">
      <SectionHead id="left-repertoire" title="Left your repertoire" count={list.length} />
      {list.length === 0 ? (
        <EmptySpecimen title="No games left your repertoire" hint="Games where you played something other than your locked move show up here." />
      ) : (
        <ul>
          {list.map((d, i) => {
            const tail = lineTail(d.line);
            const opp = d.game.opponent || "Unknown";
            const rating = d.game.opponent_rating != null ? ` (${d.game.opponent_rating})` : "";
            const body = (
              <>
                <span className="flex min-w-0 items-baseline gap-2 text-sm">
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{shortDate(d.game.date)}</span>
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-ink">{opp}</span>
                    <span className="text-muted-foreground tabular-nums">{rating}</span>
                  </span>
                  {d.game.url && <ExternalLink aria-hidden className="ml-auto size-3.5 shrink-0 text-muted-foreground" />}
                </span>
                <span className="text-sm">
                  played <span className="font-mono font-semibold text-ink">{d.played}</span> instead of <span className="font-mono font-semibold text-ink">{d.expected}</span>
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground" title={tail.full}>
                  {tail.short}
                </span>
              </>
            );
            return (
              <li key={`${d.game.game_id}-${i}`} className="border-b border-rule last:border-b-0">
                {d.game.url ? (
                  <a href={d.game.url} target="_blank" rel="noopener noreferrer" title={`Open the game against ${opp}`} className={rowButton}>
                    {body}
                  </a>
                ) : (
                  <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PaperSheet>
  );
}
