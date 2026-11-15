"use client";

import Link from "next/link";
import { useAppBootstrap } from "@/hooks/use-app-bootstrap";
import { useExplorerStore } from "@/lib/store";
import { useRepertoirePage } from "@/lib/repertoire/page-store";
import { Header } from "@/components/layout/Header";
import { UrlSideSync } from "@/components/layout/UrlSideSync";
import { ImportProvider } from "@/components/players/ImportProvider";
import { ImportDialog } from "@/components/players/ImportDialog";
import { PlayerManager } from "@/components/players/PlayerManager";
import { EmptySpecimen } from "@/components/field";
import { PaperSheet, UnderSheet } from "@/components/paper";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RepertoireDataProvider, useRepertoireData } from "@/components/repertoire/repertoire-data";
import { RepertoireBoard, useBoardPosition } from "@/components/repertoire/RepertoireBoard";
import { PositionPanel } from "@/components/repertoire/PositionPanel";
import { RepertoireSummary } from "@/components/repertoire/RepertoireSummary";
import { PointList, PointListSkeleton } from "@/components/repertoire/PointList";
import { LeftRepertoire, YourRepertoire } from "@/components/repertoire/RepertoireSections";
import { epdOf } from "@/components/repertoire/format";

/**
 * --board-size as on the explorer (AppShell's BOARD_COLUMN): the viewport minus the gutters on phones (at most 54% of
 * its height); on desktop about 64% of the width right of the rail, at most the viewport height minus the chrome.
 */
const BOARD_COLUMN =
  "[--board-size:min(calc(100vw-1.5rem),54dvh)] lg:[--board-size:min(clamp(22rem,calc((min(100vw,1600px)-5.5rem)*0.64-1rem),64rem),calc(100dvh-8.125rem))]";

const GRID = `mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] ${BOARD_COLUMN}`;

/** First paint: the board mat and the report sheets, as pencilled lines. */
function LoadingShell() {
  return (
    <div className={GRID} aria-busy="true">
      <div className="px-3 pt-4 pb-2 sm:px-4 lg:pt-[18px] lg:pr-4 lg:pb-3">
        <PaperSheet className="flex flex-col gap-1.5 p-2.5" style={{ width: "calc(var(--board-size) + 1.25rem)", maxWidth: "100%" }}>
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-9 w-32" />
        </PaperSheet>
      </div>
      <div className="flex min-w-0 flex-col gap-4 px-3 pb-6 sm:px-4 lg:pt-[18px] lg:pl-1">
        <PaperSheet className="flex flex-col gap-2 p-3">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-full" />
        </PaperSheet>
        <PointListSkeleton />
      </div>
    </div>
  );
}

function NoGames() {
  return (
    <div className="mx-auto w-full max-w-xl px-3 pt-8 pb-8 sm:px-4">
      <div className="relative isolate">
        <UnderSheet seed="rep-empty" dx={6} dy={7} rotate={-0.8} />
        <PaperSheet as="section">
          <EmptySpecimen
            title="No games yet"
            hint="Import your games in the explorer first. The repertoire is built from them."
            action={
              <Button asChild>
                <Link href="/">Go to the explorer</Link>
              </Button>
            }
          />
        </PaperSheet>
      </div>
    </div>
  );
}

function ReportError() {
  const { error, retry } = useRepertoireData();
  return (
    <PaperSheet as="section" className="min-w-0">
      <EmptySpecimen
        role="alert"
        title="The repertoire could not be built"
        hint={error ?? undefined}
        action={
          <Button variant="outline" onClick={retry}>
            Try again
          </Button>
        }
      />
    </PaperSheet>
  );
}

function BoardColumn() {
  const { side, pointsByEpd, entriesByEpd } = useRepertoireData();
  const { fen } = useBoardPosition();
  const selectedEpd = useRepertoirePage((s) => s.selectedEpd);
  const select = useRepertoirePage((s) => s.select);
  const epd = epdOf(fen);
  const point = pointsByEpd.get(epd);
  const entry = entriesByEpd.get(epd);
  const moves = point?.moves ?? [];
  const locked = point?.locked ?? entry?.san ?? null;

  const onReset = () => {
    const sel = selectedEpd ? (pointsByEpd.get(selectedEpd)?.line ?? entriesByEpd.get(selectedEpd)?.line) : null;
    select(selectedEpd, sel ?? []);
  };

  return (
    <div className="flex flex-col gap-4">
      <RepertoireBoard side={side} moves={moves} locked={locked} onReset={onReset} />
      <div className="mx-auto w-[var(--board-size)] max-w-full lg:mx-0 lg:w-[calc(var(--board-size)+1.25rem)]">
        <PositionPanel />
      </div>
    </div>
  );
}

function ReportColumn() {
  const { report, stale, error } = useRepertoireData();
  const showError = !!error && (stale || !report);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <RepertoireSummary />
      {showError ? (
        <ReportError />
      ) : stale || !report ? (
        <PointListSkeleton />
      ) : (
        <>
          <PointList />
          <YourRepertoire />
          <LeftRepertoire />
        </>
      )}
    </div>
  );
}

/** The Repertoire page: the desk and rail of the explorer, the board on the left, the report on the right. */
export function RepertoireShell() {
  useAppBootstrap();
  const ready = useExplorerStore((s) => s.ready);
  const hasPlayers = useExplorerStore((s) => s.players.length > 0);
  const page = ready && hasPlayers;

  return (
    <TooltipProvider>
      <ImportProvider>
        <div className="flex min-h-dvh flex-col desk overflow-x-clip lg:h-dvh lg:flex-row lg:overflow-hidden">
          <UrlSideSync />
          <Header showTools={page} page="repertoire" />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:overflow-y-auto">
            {!ready && <LoadingShell />}
            {ready && !hasPlayers && <NoGames />}
            {page && (
              <RepertoireDataProvider>
                <main className={`${GRID} min-h-0 lg:grid-rows-[minmax(0,1fr)]`}>
                  <section aria-label="Board" className="px-3 pt-4 pb-2 sm:px-4 lg:h-full lg:overflow-y-auto lg:pt-4 lg:pr-4 lg:pb-5">
                    <BoardColumn />
                  </section>
                  <section aria-label="Report" className="flex min-w-0 flex-col px-3 pb-6 sm:px-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pt-[18px] lg:pb-5 lg:pl-1">
                    <ReportColumn />
                  </section>
                </main>
              </RepertoireDataProvider>
            )}
          </div>
          <ImportDialog />
          <PlayerManager />
        </div>
      </ImportProvider>
    </TooltipProvider>
  );
}
