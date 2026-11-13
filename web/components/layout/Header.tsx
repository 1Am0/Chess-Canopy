"use client";

import { ChevronRight, Filter, HelpCircle, Plus } from "lucide-react";
import { activeFilterCount, useExplorerStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ImportIndicator } from "@/components/players/ImportIndicator";
import { PlayerSwitcher } from "@/components/players/PlayerSwitcher";
import { Logo } from "@/components/layout/Logo";
import { MoreMenu } from "@/components/layout/MoreMenu";
import { SoundToggle } from "@/components/layout/SoundToggle";
import { TornEdge } from "@/components/paper";
import { RAIL_BTN, RAIL_LABEL, RAIL_LABEL_LG } from "@/components/layout/rail";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-auto hidden rounded-[2px] border border-rule-strong/70 px-1.5 font-mono text-[11px] leading-4 text-muted-foreground lg:inline lg:opacity-0 lg:transition-opacity lg:duration-150 lg:rail-open:opacity-100 lg:rail-open:delay-75">
      {children}
    </kbd>
  );
}

export function Header({ showTools }: { showTools: boolean }) {
  const filters = useExplorerStore((s) => s.filters);
  const setUi = useExplorerStore((s) => s.setUi);
  const count = activeFilterCount(filters);

  return (
    <header
      className="paper-scope rail sticky top-0 z-20 bg-[var(--strip)] forced-colors:border-b lg:h-dvh lg:w-14 lg:shrink-0 lg:overflow-visible"
      style={{ backgroundImage: "var(--sheet-tile)" }}
    >
      {/* a torn strip of cream paper laid across the top of the desk */}
      <TornEdge seed={11} className="lg:hidden" />
      {/*
        Desktop: a 56px rail that grows to 224px on hover or focus (width only; the content is laid out for the open width
        and clipped, so nothing re-wraps). The edge shadow and the "opens" tab are separate elements that only change opacity.
      */}
      <div
        style={{ backgroundImage: "var(--sheet-tile)" }}
        className="mx-auto max-w-[1600px] lg:absolute lg:inset-y-0 lg:left-0 lg:mx-0 lg:w-14 lg:max-w-none lg:border-r lg:border-rule lg:bg-[var(--strip)] lg:rail-open:w-56 lg:transition-[width] lg:duration-200 lg:ease-out motion-reduce:transition-none"
      >
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4 lg:h-full lg:flex-col lg:items-stretch lg:gap-3 lg:overflow-hidden lg:px-2 lg:py-4">
          <div className="mr-1 flex shrink-0 items-center gap-2 text-primary lg:pl-[5.5px]">
            <Logo className="size-7" />
            <span className="hidden whitespace-nowrap font-serif text-xl leading-none font-semibold tracking-tight text-foreground sm:inline lg:opacity-0 lg:transition-opacity lg:duration-150 lg:rail-open:opacity-100 lg:rail-open:delay-75">Chess Canopy</span>
          </div>
          {showTools && <div className="min-w-0 shrink lg:shrink-0" data-testid="player-switcher"><PlayerSwitcher /></div>}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 max-sm:gap-2 lg:ml-0 lg:min-h-0 lg:flex-1 lg:flex-col lg:items-stretch">
            {showTools && <ImportIndicator />}
            {showTools && (
              <Button
                variant="chit"
                size="sm"
                className={`relative max-sm:h-11 max-sm:min-w-11 max-sm:px-3 ${RAIL_BTN}`}
                onClick={() => setUi({ filtersOpen: true })}
                aria-label={`Filters${count ? `, ${count} active` : ""}`}
              >
                <Filter />
                <span className={RAIL_LABEL}>Filters</span>
                {count > 0 && (
                  <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary font-mono text-[11px] font-semibold text-primary-foreground tabular-nums shadow-[0_0_0_1.5px_var(--sheet-flat),0.5px_1px_1px_var(--btn-drop)] lg:absolute lg:-top-1.5 lg:-right-1.5 lg:size-4 lg:text-[10px]">
                    {count}
                  </span>
                )}
              </Button>
            )}
            {showTools && (
              <Button variant="chit" size="sm" className={`max-sm:h-11 max-sm:min-w-11 max-sm:px-3 ${RAIL_BTN}`} onClick={() => setUi({ importOpen: true })} aria-label="Import games">
                <Plus />
                <span className={RAIL_LABEL}>Import</span>
              </Button>
            )}
            <MoreMenu />
            <div className="flex items-center gap-1.5 max-sm:contents lg:mt-auto lg:flex-col lg:items-stretch">
              <SoundToggle className={`max-sm:hidden ${RAIL_BTN}`} label="Sound" />
              <Button variant="chit" size="icon" className={`max-sm:hidden ${RAIL_BTN}`} onClick={() => setUi({ shortcutsOpen: true })} aria-label="Keyboard shortcuts">
                <HelpCircle />
                <span className={RAIL_LABEL_LG}>Shortcuts</span>
                <Kbd>?</Kbd>
              </Button>
            </div>
          </div>
        </div>
        {/* soft shadow on the open rail's right edge, so it reads as a drawer laid over the board */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 left-full hidden h-full w-4 bg-gradient-to-r from-[color-mix(in_oklab,var(--shadow-ink)_30%,transparent)] to-transparent opacity-0 transition-opacity duration-200 motion-reduce:transition-none lg:block lg:rail-open:opacity-100"
        />
        {/* a small tab on the edge of the collapsed rail: it opens on hover or focus */}
        {showTools && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-full hidden h-12 w-3.5 -translate-y-1/2 items-center justify-center rounded-r-[3px] border border-l-0 border-rule-strong/70 bg-[var(--strip)] text-muted-foreground shadow-[1px_1px_2px_var(--btn-drop)] transition-opacity duration-150 motion-reduce:transition-none lg:flex lg:rail-open:opacity-0"
            style={{ backgroundImage: "var(--sheet-tile)" }}
          >
            <ChevronRight className="size-3" strokeWidth={2.5} />
          </span>
        )}
      </div>
    </header>
  );
}
