"use client";

import Link from "next/link";
import { useAppBootstrap } from "@/hooks/use-app-bootstrap";
import { useExplorerStore } from "@/lib/store";
import { Header } from "@/components/layout/Header";
import { BOARD_COLUMN, LoadingShell } from "@/components/layout/AppShell";
import { UrlSideSync } from "@/components/layout/UrlSideSync";
import { ImportProvider } from "@/components/players/ImportProvider";
import { ImportDialog } from "@/components/players/ImportDialog";
import { PlayerManager } from "@/components/players/PlayerManager";
import { EmptySpecimen } from "@/components/field";
import { PaperSheet, UnderSheet } from "@/components/paper";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RepertoireDataProvider } from "@/components/repertoire/repertoire-data";
import { RepertoireBoardColumn } from "@/components/repertoire/RepertoireBoardColumn";
import { RepertoirePanel } from "@/components/repertoire/RepertoirePanel";

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

/** The Repertoire page, in the explorer's frame (AppShell): the same desk, rail, grid, board column and sheet. */
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
                <main
                  className={`mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] ${BOARD_COLUMN}`}
                >
                  <section aria-label="Board" className="px-3 pt-4 pb-2 sm:px-4 lg:h-full lg:overflow-hidden lg:pt-4 lg:pr-4 lg:pb-3">
                    <RepertoireBoardColumn />
                  </section>
                  <aside
                    aria-label="Repertoire"
                    className="flex min-w-0 flex-col px-3 pb-6 sm:px-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pt-[18px] lg:pb-5 lg:pl-1"
                  >
                    <RepertoirePanel />
                  </aside>
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
