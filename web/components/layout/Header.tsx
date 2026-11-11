"use client";

import { Filter, HelpCircle, Plus } from "lucide-react";
import { activeFilterCount, useExplorerStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ImportIndicator } from "@/components/players/ImportIndicator";
import { PlayerSwitcher } from "@/components/players/PlayerSwitcher";
import { Logo } from "@/components/layout/Logo";
import { MoreMenu } from "@/components/layout/MoreMenu";
import { SoundToggle } from "@/components/layout/SoundToggle";
import { TornEdge } from "@/components/paper";

export function Header({ showTools }: { showTools: boolean }) {
  const filters = useExplorerStore((s) => s.filters);
  const setUi = useExplorerStore((s) => s.setUi);
  const count = activeFilterCount(filters);

  return (
    <header
      className={`paper-scope rail sticky top-0 z-20 bg-[var(--strip)] forced-colors:border-b ${showTools ? "lg:h-dvh lg:w-14 lg:shrink-0 lg:overflow-visible " : ""}`}
      style={{ backgroundImage: "var(--sheet-tile)" }}
    >
      {/* a torn strip of cream paper laid across the top of the desk */}
      <TornEdge seed={11} className={showTools ? "lg:hidden" : undefined} />
      <div style={showTools ? { backgroundImage: "var(--sheet-tile)" } : undefined} className={`mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 sm:px-4 ${showTools ? "lg:absolute lg:inset-y-0 lg:left-0 lg:w-14 lg:overflow-hidden lg:border-r lg:border-rule lg:bg-[var(--strip)] lg:rail-open:w-48 lg:transition-[width,box-shadow] lg:duration-200 lg:ease-out motion-reduce:transition-none lg:rail-open:shadow-[4px_0_14px_-6px_rgba(0,0,0,0.35)] lg:h-full lg:max-w-none lg:flex-col lg:items-stretch lg:gap-3 lg:px-2 lg:py-4" : ""}`}>
        <div className="mr-1 flex shrink-0 items-center gap-2 text-primary">
          <Logo className="size-7" />
          <span className="hidden whitespace-nowrap font-serif text-xl lg:inline lg:opacity-0 lg:transition-opacity lg:duration-150 lg:rail-open:opacity-100 lg:rail-open:delay-75 leading-none font-semibold tracking-tight text-foreground sm:inline">Chess Canopy</span>
        </div>
        {showTools && <div className="min-w-0 shrink lg:shrink-0" data-testid="player-switcher"><PlayerSwitcher /></div>}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 max-sm:gap-2 lg:ml-0 lg:min-h-0 lg:flex-1 lg:flex-col lg:items-stretch">
          {showTools && <ImportIndicator />}
          {showTools && (
            <Button variant="chit" size="sm" className="max-sm:h-9 max-sm:px-2.5 lg:w-full lg:justify-start lg:px-[11px]" onClick={() => setUi({ filtersOpen: true })} aria-label={`Filters${count ? `, ${count} active` : ""}`}>
              <Filter />
              <span className="hidden sm:inline lg:inline lg:opacity-0 lg:transition-opacity lg:duration-150 lg:rail-open:opacity-100 lg:rail-open:delay-75">Filters</span>
              {count > 0 && (
                <span className="ml-0.5 flex size-5 lg:absolute lg:-top-1.5 lg:-right-1.5 lg:size-4 lg:text-[10px] items-center justify-center rounded-full bg-primary font-mono text-[11px] font-semibold text-primary-foreground tabular-nums shadow-[0_0_0_1.5px_var(--sheet-flat),0.5px_1px_1px_var(--btn-drop)]">
                  {count}
                </span>
              )}
            </Button>
          )}
          {showTools && (
            <Button variant="chit" size="sm" className="max-sm:h-9 max-sm:px-2.5 lg:w-full lg:justify-start lg:px-[11px]" onClick={() => setUi({ importOpen: true })} aria-label="Import games">
              <Plus />
              <span className="hidden sm:inline lg:inline lg:opacity-0 lg:transition-opacity lg:duration-150 lg:rail-open:opacity-100 lg:rail-open:delay-75">Import</span>
            </Button>
          )}
          <MoreMenu />
          <div className="flex items-center gap-1.5 max-sm:contents lg:mt-auto lg:flex-col">
            <SoundToggle className="max-sm:hidden" />
            <Button variant="chit" size="icon" className="max-sm:hidden" onClick={() => setUi({ shortcutsOpen: true })} aria-label="Keyboard shortcuts">
              <HelpCircle />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
