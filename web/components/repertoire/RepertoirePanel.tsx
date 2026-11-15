"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { clampGamesPane } from "@/lib/store";
import { useRepertoirePage } from "@/lib/repertoire/page-store";
import { SplitHandle } from "@/components/explorer/SplitHandle";
import { EmptySpecimen } from "@/components/field";
import { PaperSheet, Tape, UnderSheet } from "@/components/paper";
import { Button } from "@/components/ui/button";
import { useRepertoireData } from "@/components/repertoire/repertoire-data";
import { RepertoireSideSwitch } from "@/components/repertoire/RepertoireSideSwitch";
import { RepertoireOpening } from "@/components/repertoire/RepertoireOpening";
import { SettingsRow } from "@/components/repertoire/SettingsRow";
import { RepertoireLine } from "@/components/repertoire/RepertoireLine";
import { PositionTable } from "@/components/repertoire/PositionTable";
import { RepertoireLists } from "@/components/repertoire/RepertoireLists";

/**
 * The explorer's ExplorerPanel for the Repertoire page, the same stack of fixed-height slots:
 *
 *   desktop (lg+, exactly the viewport height under the header, no outer scroll):
 *     side switch 44 · opening 28 · settings 32 · line strip 44 ·
 *     a region (flex 1) split between "This position" and the lists by the explorer's draggable handle.
 *   mobile: the same, in a region of fixed height max(26rem, 52vh).
 * The split is the user's choice (persisted); moving it never changes the region itself.
 */
export function RepertoirePanel() {
  const saved = useRepertoirePage((s) => s.split);
  const setSplit = useRepertoirePage((s) => s.setSplit);
  const { report, stale, error, retry } = useRepertoireData();
  const [live, setLive] = useState<number | null>(null);
  const region = useRef<HTMLElement>(null);
  const f = clampGamesPane(live ?? saved);
  const showError = !!error && (stale || !report);

  return (
    <div className="relative isolate z-10 min-w-0 lg:h-full lg:min-h-0">
      <UnderSheet seed={7} dx={7} dy={8} rotate={-1} />
      <PaperSheet className="@container/sheet flex min-w-0 flex-col gap-2 p-3 pt-4 lg:h-full lg:min-h-0">
        <Tape variant="ochre" angle={-3} seed="top-l" className="-top-1.5 left-6" />
        <Tape variant="ochre" angle={2.5} seed="top-r" className="-top-1.5 right-6" />
        <RepertoireSideSwitch />
        <RepertoireOpening />
        <SettingsRow />
        <RepertoireLine />
        <section
          ref={region}
          aria-label="This position and lists"
          data-testid="repertoire-region"
          className="-mx-3 -mb-3 flex h-[max(26rem,52vh)] min-h-0 flex-col overflow-hidden border-t border-rule lg:h-auto lg:min-h-[16rem] lg:flex-1"
        >
          {showError ? (
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden" role="alert">
              <EmptySpecimen
                className="py-2"
                title="The repertoire could not be built"
                hint={error ?? undefined}
                action={
                  <Button size="sm" variant="outline" onClick={retry}>
                    <RotateCcw /> Retry
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div aria-label="This position" role="region" className="min-h-0" style={{ flex: `${1 - f} 1 0px` }}>
                <PositionTable />
              </div>
              <SplitHandle
                value={f}
                region={region}
                onLive={setLive}
                onCommit={(v) => {
                  setSplit(v);
                  setLive(null);
                }}
              />
              <div className="min-h-0" style={{ flex: `${f} 1 0px` }}>
                <RepertoireLists />
              </div>
            </>
          )}
        </section>
      </PaperSheet>
    </div>
  );
}
