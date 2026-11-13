"use client";

import { useRef, useState } from "react";
import { SideSwitch } from "@/components/layout/SideSwitch";
import { FilterRow } from "@/components/filters/FilterRow";
import { LinePanel } from "@/components/explorer/LinePanel";
import { PositionAnnouncer } from "@/components/explorer/PositionAnnouncer";
import { OpeningHeader } from "@/components/explorer/OpeningHeader";
import { MoveTable } from "@/components/explorer/MoveTable";
import { GamesList } from "@/components/explorer/GamesList";
import { SplitHandle } from "@/components/explorer/SplitHandle";
import { clampGamesPane, useExplorerStore } from "@/lib/store";
import { PaperSheet, Tape, UnderSheet } from "@/components/paper";

/**
 * The workspace column, as a stack of fixed-height slots so nothing moves when moves
 * are played (Lichess / chess.com style):
 *
 *   desktop (lg+, exactly the viewport height under the header, no outer scroll):
 *     SideSwitch 44 · opening 28 · filters 32 · Line strip 44 ·
 *     a region (flex 1) split between the move table and the games list by a draggable handle.
 *   mobile: the same, in a region of fixed height max(26rem, 52vh).
 * The split is the user's choice (persisted); moving it never changes the region itself.
 */
export function ExplorerPanel() {
  const saved = useExplorerStore((s) => s.gamesPane);
  const setGamesPane = useExplorerStore((s) => s.setGamesPane);
  const [live, setLive] = useState<number | null>(null);
  const region = useRef<HTMLElement>(null);
  const f = clampGamesPane(live ?? saved);

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
      <section
        ref={region}
        aria-label="Moves and games"
        data-testid="explorer-region"
        className="-mx-3 -mb-3 flex h-[max(26rem,52vh)] min-h-0 flex-col overflow-hidden border-t border-rule lg:h-auto lg:min-h-[16rem] lg:flex-1"
      >
        <div aria-label="Moves" role="region" className="min-h-0" style={{ flex: `${1 - f} 1 0px` }}>
          <MoveTable />
        </div>
        <SplitHandle
          value={f}
          region={region}
          onLive={setLive}
          onCommit={(v) => {
            setGamesPane(v);
            setLive(null);
          }}
        />
        <div className="min-h-0" style={{ flex: `${f} 1 0px` }}>
          <GamesList />
        </div>
      </section>
    </PaperSheet>
    </div>
  );
}
