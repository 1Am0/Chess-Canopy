"use client";

import { useExplorerSync, useKeyboardShortcuts } from "@/hooks/use-explorer-sync";
import { useMoveSounds } from "@/hooks/use-move-sounds";
import { useExplorerStore } from "@/lib/store";
import { Header } from "@/components/layout/Header";
import { UrlSideSync } from "@/components/layout/UrlSideSync";
import { ShortcutsDialog } from "@/components/layout/ShortcutsDialog";
import { BoardColumn } from "@/components/board/BoardColumn";
import { ExplorerPanel } from "@/components/explorer/ExplorerPanel";
import { FilterSheet } from "@/components/filters/FilterSheet";
import { ImportProvider } from "@/components/players/ImportProvider";
import { ImportDialog } from "@/components/players/ImportDialog";
import { PlayerManager } from "@/components/players/PlayerManager";
import { Welcome } from "@/components/onboarding/Welcome";
import { PaperSheet } from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * --board-size is the width (and height) of the board itself:
 *   mobile : the viewport minus a 12px gutter on each side, at most 62% of the viewport height
 *            (so a tablet in portrait still shows the move table without scrolling far)
 *   desktop (left rail 3.5rem, icons only, no top header): min( clamp(22rem, ~64% of the width right of the rail, 64rem),
 *                 viewport height - chrome (8.125rem: strips + toolbar + padding) )
 * The content width is min(100vw, 1600px) minus the page padding (2rem) and the
 * workspace gap (1rem).
 * Round 3: the board sits on a mat (12px) under the torn header edge (24px top padding), so the
 * chrome is 11.625rem, sized so the board sheet ends level with the explorer sheet.
 */
const BOARD_COLUMN =
  "[--board-size:min(calc(100vw-1.5rem),62dvh)] lg:[--board-size:min(clamp(22rem,calc((min(100vw,1600px)-5.5rem)*0.64-1rem),64rem),calc(100dvh-8.125rem))]";

/**
 * Placeholder with the same slots as the explorer, so the first paint doesn't jump: the desk, a mat for the board
 * and a sheet for the explorer, each with pencilled ruled lines where the content will be written.
 */
function LoadingShell() {
  return (
    <div className={`mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] ${BOARD_COLUMN}`} aria-busy="true">
      <div className="px-3 pt-4 pb-2 sm:px-4 lg:pt-[18px] lg:pr-4 lg:pb-3">
        <PaperSheet className="flex flex-col gap-1.5 p-2.5" style={{ width: "calc(var(--board-size) + 1.25rem)", maxWidth: "100%" }}>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-7 w-40" />
        </PaperSheet>
      </div>
      <div className="flex min-w-0 flex-col px-3 pb-6 sm:px-4 lg:pt-[18px] lg:pl-1">
        <PaperSheet className="flex flex-col gap-2 p-3">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="hidden h-[154px] w-full lg:block" />
          <Skeleton className="h-[52px] w-full" />
          <Skeleton className="h-64 w-full" />
        </PaperSheet>
      </div>
    </div>
  );
}

export function AppShell() {
  useExplorerSync();
  useKeyboardShortcuts();
  useMoveSounds();
  const ready = useExplorerStore((s) => s.ready);
  const hasPlayers = useExplorerStore((s) => s.players.length > 0);
  const explorer = ready && hasPlayers;

  return (
    <TooltipProvider>
      <ImportProvider>
      <div className={`flex min-h-dvh flex-col desk overflow-x-clip lg:h-dvh lg:flex-row lg:overflow-hidden`}>
        <UrlSideSync />
        <Header showTools={explorer} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:overflow-y-auto">
        {!ready && <LoadingShell />}
        {ready && !hasPlayers && <Welcome />}
        {explorer && (
          <main
            className={`mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] ${BOARD_COLUMN}`}
          >
            <section
              aria-label="Board"
              className="px-3 pt-4 pb-2 sm:px-4 lg:h-full lg:overflow-hidden lg:pt-4 lg:pr-4 lg:pb-3"
            >
              <BoardColumn />
            </section>
            {/*
              Desktop: exactly the height under the header, like the board column. Every
              slot inside has a fixed height and the explorer region takes the rest, so
              there is no outer scroll (only very short viewports fall back to scrolling).
            */}
            <aside
              aria-label="Explorer"
              className="flex min-w-0 flex-col px-3 pb-6 sm:px-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pt-[18px] lg:pb-5 lg:pl-1"
            >
              <ExplorerPanel />
            </aside>
          </main>
        )}
        </div>
        <FilterSheet />
        <ImportDialog />
        <PlayerManager />
        <ShortcutsDialog />
      </div>
      </ImportProvider>
    </TooltipProvider>
  );
}
