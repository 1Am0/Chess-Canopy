"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import type { Color } from "@/lib/engine/types";
import type { MoveEval, NewRepertoireEntry } from "@/lib/repertoire/types";
import { pct } from "@/lib/format";
import { Kicker } from "@/components/field";
import { PaperSheet, RubberStamp, StringTag } from "@/components/paper";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRepertoireData } from "@/components/repertoire/repertoire-data";
import { useBoardPosition } from "@/components/repertoire/RepertoireBoard";
import { useOpening } from "@/components/repertoire/use-opening";
import { VerdictChip } from "@/components/repertoire/VerdictChip";
import { epdOf, lineTail, lossLabel, verdictPhrase } from "@/components/repertoire/format";

type Pending = { entry: NewRepertoireEntry; ev: MoveEval };

/** "Open in explorer" link for a line on this side. */
function ExplorerLink({ line, side }: { line: string[]; side: Color }) {
  const href = `/?${line.length ? `line=${line.map(encodeURIComponent).join(",")}&` : ""}side=${side}`;
  return (
    <Button asChild variant="outline" size="sm" className="max-sm:h-10">
      <Link href={href}>
        <Compass />
        Open in explorer
      </Link>
    </Button>
  );
}

/**
 * Under the board: what you play in the position on the board. For a report position, every move you played with a
 * "Lock in" button (the suggested one tagged); for a locked one, your move and "Unlock". After you play a move of your
 * own on the board in a position that is not saved yet, "Lock in {san} here" for the position before it. A move the
 * engine rates dubious or a mistake asks once more before it is saved.
 */
export function PositionPanel() {
  const { side, pointsByEpd, entriesByEpd, evals, busy, lock, unlock } = useRepertoireData();
  const { at, sans, fens, fen, turn, visible } = useBoardPosition();
  const [pending, setPending] = useState<Pending | null>(null);
  const opening = useOpening(visible);

  const yourTurn = turn === (side === "white" ? "w" : "b");
  const epd = epdOf(fen);
  const point = yourTurn ? pointsByEpd.get(epd) : undefined;
  const entry = yourTurn ? entriesByEpd.get(epd) : undefined;

  // The position before the last move, when that move was yours (the board is now on the opponent's turn).
  const prev = !yourTurn && at > 0 ? { epd: epdOf(fens[at - 1]), fen: fens[at - 1], san: sans[at - 1], line: sans.slice(0, at - 1) } : null;
  const prevEntry = prev ? entriesByEpd.get(prev.epd) : undefined;

  const requestLock = (entry: NewRepertoireEntry) => {
    const ev = evals.get(entry.epd)?.moves[entry.san];
    if (ev && (ev.verdict === "dubious" || ev.verdict === "bad")) {
      setPending({ entry, ev });
      return;
    }
    setPending(null);
    void lock(entry);
  };
  const pendingHere = pending && (pending.entry.epd === epd || pending.entry.epd === prev?.epd) ? pending : null;

  const tail = lineTail(visible);
  const locked = point?.locked ?? entry?.san ?? null;

  return (
    <PaperSheet as="section" aria-labelledby="this-position" className="flex min-w-0 flex-col gap-3 p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Kicker as="h2" id="this-position" className="mb-0">
          This position
        </Kicker>
        <p className="truncate font-mono text-sm text-ink" title={tail.full}>
          {tail.short}
        </p>
        {opening && (
          <p className="flex min-w-0 items-center gap-1 text-sm">
            <StringTag>{opening.eco}</StringTag>
            <span className="truncate font-serif text-muted-foreground italic">{opening.name}</span>
          </p>
        )}
      </div>

      {yourTurn && locked && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-sm">
            Your move: <span className="font-mono font-semibold text-ink">{locked}</span>
          </p>
          <Button variant="outline" size="sm" className="max-sm:h-10" disabled={busy} onClick={() => void unlock(epd, locked)}>
            Unlock
          </Button>
          {!point && <span className="text-xs text-muted-foreground">Not in your games yet</span>}
        </div>
      )}

      {point && (
        <ul aria-label="Moves you played here" className="border-t border-rule">
          {point.moves.map((m) => {
            const isLocked = m.san === point.locked;
            const suggested = !point.locked && m.san === point.main;
            return (
              <li key={m.san} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule py-1.5">
                <span className="w-14 shrink-0 font-mono text-sm font-semibold text-ink">{m.san}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {m.games} {m.games === 1 ? "game" : "games"} · {pct(point.games ? m.games / point.games : 0)}
                </span>
                <VerdictChip ev={evals.get(point.epd)?.moves[m.san]} />
                {suggested && (
                  <RubberStamp size="sm" variant="single" tone="muted" rotate={1} seed={`s-${point.epd}`}>
                    Suggested
                  </RubberStamp>
                )}
                <span className="ml-auto">
                  {isLocked ? (
                    <RubberStamp size="sm" seed={`l-${point.epd}`}>
                      Your move
                    </RubberStamp>
                  ) : (
                    <Button
                      variant={suggested ? "default" : "outline"}
                      size="sm"
                      className="max-sm:h-10"
                      disabled={busy}
                      onClick={() => requestLock({ side, epd: point.epd, fen: point.fen, san: m.san, line: visible })}
                    >
                      Lock in {m.san}
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {yourTurn && !point && !locked && (
        <p className="text-sm text-muted-foreground">
          This position isn&apos;t in your report. Play your move on the board to add it to your repertoire.
        </p>
      )}

      {!yourTurn && prev && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {prevEntry?.san === prev.san ? (
            <p className="text-sm">
              Your move here: <span className="font-mono font-semibold text-ink">{prev.san}</span>
            </p>
          ) : (
            <>
              {prevEntry && (
                <p className="w-full text-sm text-muted-foreground">
                  Your move here is <span className="font-mono text-ink">{prevEntry.san}</span>.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="max-sm:h-10"
                disabled={busy}
                onClick={() => requestLock({ side, epd: prev.epd, fen: prev.fen, san: prev.san, line: prev.line })}
              >
                Lock in {prev.san} here
              </Button>
            </>
          )}
        </div>
      )}

      {!yourTurn && !prev && <p className="text-sm text-muted-foreground">White moves first. Play a move on the board to reach your position.</p>}

      {pendingHere && (
        <div role="alert" className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-rule pt-2.5 text-sm")}>
          <p className="min-w-0 flex-1 basis-60">
            The engine rates <span className="font-mono font-semibold">{pendingHere.entry.san}</span> as {verdictPhrase(pendingHere.ev.verdict)} here
            {pendingHere.ev.lossCp != null && pendingHere.ev.lossCp > 0 ? ` (${lossLabel(pendingHere.ev.lossCp)})` : ""}. Lock it in anyway?
          </p>
          <span className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="max-sm:h-10"
              disabled={busy}
              onClick={() => {
                const e = pendingHere.entry;
                setPending(null);
                void lock(e);
              }}
            >
              Lock in anyway
            </Button>
            <Button variant="outline" size="sm" className="max-sm:h-10" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </span>
        </div>
      )}

      <div>
        <ExplorerLink line={visible} side={side} />
      </div>
    </PaperSheet>
  );
}
