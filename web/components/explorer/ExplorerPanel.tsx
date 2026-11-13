"use client";

import { SideSwitch } from "@/components/layout/SideSwitch";
import { FilterRow } from "@/components/filters/FilterRow";
import { LinePanel } from "@/components/explorer/LinePanel";
import { PositionAnnouncer } from "@/components/explorer/PositionAnnouncer";
import { OpeningHeader } from "@/components/explorer/OpeningHeader";
import { MoveTable } from "@/components/explorer/MoveTable";
import { PaperSheet, Tape, UnderSheet } from "@/components/paper";

/**
 * The workspace column, as a stack of fixed-height slots so nothing moves when moves
 * are played (Lichess / chess.com style):
 *
 *   desktop (lg+, exactly the viewport height under the header, no outer scroll):
 *     SideSwitch 44 · opening 28 · filters 32 · Line strip 44 ·
 *     move table (flex 1, its own scroll region).
 *   mobile: SideSwitch · opening · filters · move table of fixed height max(22rem, 45vh).
 */
export function ExplorerPanel() {
  return (
    // One cream sheet with a second sheet peeking out from under it and a strip of tape across its top edge.
    <div className="relative isolate z-10 min-w-0 lg:h-full lg:min-h-0">
    <UnderSheet seed={7} dx={7} dy={8} rotate={-1} />
    <PaperSheet className="@container/sheet flex min-w-0 flex-col gap-2 p-3 pt-4 lg:h-full lg:min-h-0">
      <Tape variant="ochre" angle={-3} seed="top-l" className="-top-1.5 left-6" />
      <Tape variant="ochre" angle={2.5} seed="top-r" className="-top-1.5 right-6" />
      <PositionAnnouncer />
      <SideSwitch />
      <OpeningHeader />
      <FilterRow />
      <LinePanel />
      {/* Moves only: the summary bar and the Games / Canopy tabs are off while trying this layout. */}
      <section
        aria-label="Moves"
        data-testid="explorer-region"
        className="-mx-3 -mb-3 h-[max(22rem,45vh)] min-h-0 overflow-hidden border-t border-rule lg:h-auto lg:min-h-[13rem] lg:flex-1"
      >
        <MoveTable />
      </section>
    </PaperSheet>
    </div>
  );
}
