"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CanopyTree } from "@/lib/canopy/types";
import { BUNDLE, LEAF } from "@/lib/canopy/types";
import type { CanopyLayout } from "@/lib/canopy/layout";
import { relPath } from "@/lib/canopy/labels";
import { activeFilterCount, useExplorerStore } from "@/lib/store";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useCanopy } from "@/hooks/use-canopy";
import { useCanopyTheme } from "@/hooks/use-canopy-theme";
import { fetchLeafGame } from "@/hooks/use-canopy-game";
import { CanopyCanvas, type CanopyCanvasHandle } from "@/components/canopy/CanopyCanvas";
import { CanopyHeader } from "@/components/canopy/CanopyHeader";
import { CanopyLegend } from "@/components/canopy/CanopyLegend";
import { CanopySelectionCard } from "@/components/canopy/CanopySelectionCard";
import { CanopySheet } from "@/components/canopy/CanopySheet";
import { CanopyError, CanopyLoading, CanopyNoGames, CanopyOutOfBook } from "@/components/canopy/CanopyStates";
import { CanopyToolbar } from "@/components/canopy/CanopyToolbar";
import { CanopyTooltip } from "@/components/canopy/CanopyTooltip";
import { CanopyTreeNav } from "@/components/canopy/CanopyTreeNav";
import { lineIdsFor } from "@/components/canopy/info";
import { cn } from "@/lib/utils";

export type CanopyVariant = "compact" | "expanded" | "sheet";

/** Room the touch selection card needs at the bottom of the canvas (112 px card + 16 px). */
const CARD_RESERVE = 128;

/**
 * The Canopy view of the opening tree growing upward from the board position. `compact` fills
 * the explorer region, `expanded` the explorer column (desktop), `sheet` a full-screen dialog
 * (below lg). Below lg the compact view's Expand button opens the sheet.
 */
export function CanopyView({ variant, active }: { variant: CanopyVariant; active: boolean }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <>
      <CanopyBody
        variant={variant}
        active={active && !sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onClose={() => setSheetOpen(false)}
      />
      {variant === "compact" && (
        <CanopySheet open={sheetOpen} onOpenChange={setSheetOpen}>
          {sheetOpen && <CanopyBody variant="sheet" active onOpenSheet={() => {}} onClose={() => setSheetOpen(false)} />}
        </CanopySheet>
      )}
    </>
  );
}

function CanopyBody({
  variant,
  active,
  onOpenSheet,
  onClose,
}: {
  variant: CanopyVariant;
  active: boolean;
  onOpenSheet: () => void;
  onClose: () => void;
}) {
  const lg = useMediaQuery("(min-width: 1024px)");
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const fine = !useMediaQuery("(pointer: coarse)");
  const sheet = variant === "sheet";
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<CanopyCanvasHandle>(null);
  const summaryId = useId();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [layout, setLayout] = useState<CanopyLayout | null>(null);
  const [hover, setHover] = useState<{ id: number; anchor: { x: number; y: number } } | null>(null);
  const [focusId, setFocusId] = useState(-1);
  const [focusAnchor, setFocusAnchor] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState(-1);

  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const summary = useExplorerStore((s) => s.summary);
  const filterCount = useExplorerStore((s) => activeFilterCount(s.filters));
  const path = useExplorerStore((s) => s.path);
  const cursor = useExplorerStore((s) => s.cursor);
  const playLine = useExplorerStore((s) => s.playLine);
  const loadGame = useExplorerStore((s) => s.loadGame);
  const setHoverMove = useExplorerStore((s) => s.setHoverMove);
  const setSide = useExplorerStore((s) => s.setSide);
  const clearFilters = useExplorerStore((s) => s.clearFilters);
  const undo = useExplorerStore((s) => s.undo);
  const toStart = useExplorerStore((s) => s.toStart);
  const setCanopyExpanded = useExplorerStore((s) => s.setCanopyExpanded);

  const theme = useCanopyTheme(stageRef);
  const { tree, status, stale, retry } = useCanopy(active);

  // Measure the stage (content box); a hidden tab measures 0 and skips all drawing.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      setSize((p) => (p.w === w && p.h === h ? p : { w, h }));
    };
    read();
    const ro = new ResizeObserver(() => {
      if (!raf) raf = requestAnimationFrame(read);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Selection and hover belong to one tree.
  const [seenTree, setSeenTree] = useState<CanopyTree | null>(tree);
  if (seenTree !== tree) {
    setSeenTree(tree);
    if (selected !== -1 && tree?.path.join(" ") !== seenTree?.path.join(" ")) setSelected(-1);
  }

  // The amber arrow preview on the board follows a depth-1 hover or selection, like a table row.
  const previewId = selected >= 0 ? selected : (hover?.id ?? -1);
  const previewSan = tree && previewId > 0 && previewId < tree.n && tree.depth[previewId] === 1 ? tree.san[previewId] : "";
  useEffect(() => {
    if (!active) return;
    setHoverMove(previewSan || null);
    return () => setHoverMove(null);
  }, [previewSan, active, setHoverMove]);

  const redoRel = useMemo(() => path.slice(cursor), [path, cursor]);
  const lineIds = useMemo(() => (tree && redoRel.length ? lineIdsFor(tree, redoRel) : []), [tree, redoRel]);

  const total = tree?.rootStats.total ?? 0;
  const noGames = !!summary && summary.games === 0;
  const outOfBook = !!tree && total === 0 && !noGames && !stale;
  const single = !!tree && total === 1 && !stale;
  const other = side === "white" ? "black" : "white";
  const otherCount = summary?.counts[other] ?? 0;
  const loading = !tree && status !== "error";
  const inert = stale || !tree || status === "error";

  const play = useCallback(
    (id: number) => {
      if (!tree || id <= 0 || id >= tree.n) return;
      const kind = tree.kind[id];
      setSelected(-1);
      setHover(null);
      if (kind === BUNDLE) return;
      if (kind === LEAF && tree.san[id] !== "") {
        const cursorAt = tree.rootPly + tree.branchDepth[id];
        fetchLeafGame(tree, tree.leafRef[id]).then(
          (g) => {
            if (!g) {
              toast.error("Couldn't load that game", { id: "game-loaded" });
              return;
            }
            loadGame(g.moves, `${g.source}:${g.game_id}`, cursorAt);
            toast.success("Game loaded", { id: "game-loaded", description: "Use → to step through the rest of it." });
          },
          () => toast.error("Couldn't load that game", { id: "game-loaded" }),
        );
        return;
      }
      playLine(relPath(tree, id));
    },
    [tree, playLine, loadGame],
  );

  const onActivate = useCallback(
    (id: number, how: "mouse" | "touch") => {
      if (!tree) return;
      if (id < 0) {
        setSelected(-1);
        return;
      }
      if (how === "touch" && selected !== id) {
        setSelected(id);
        setHover(null);
        return;
      }
      play(id);
    },
    [tree, selected, play],
  );

  const onHover = useCallback((id: number, anchor: { x: number; y: number } | null) => {
    setHover(id >= 0 && anchor ? { id, anchor } : null);
  }, []);

  // Keyboard focus is mirrored on the canvas: the tooltip anchors on the node after the pan settles.
  useEffect(() => {
    if (focusId < 0) {
      setFocusAnchor(null);
      return;
    }
    const t = setTimeout(() => setFocusAnchor(canvasRef.current?.anchorOf(focusId) ?? null), reduced ? 0 : 200);
    return () => clearTimeout(t);
  }, [focusId, tree, size, reduced]);

  // Expanded: put keyboard focus on the tree, so arrows keep working after the mode switch.
  useEffect(() => {
    if (variant === "expanded") stageRef.current?.querySelector<HTMLElement>('[role="tree"]')?.focus({ preventScroll: true });
  }, [variant]);

  const collapse = () => setCanopyExpanded(false);
  const onEscape = () => {
    if (variant === "expanded") {
      collapse();
      return true;
    }
    return false;
  };
  const expand = () => (lg ? setCanopyExpanded(true) : onOpenSheet());

  const showHover = hover && tree && !inert && hover.id < tree.n ? hover : null;
  const tipTarget = showHover
    ? { id: showHover.id, anchor: showHover.anchor }
    : focusId >= 0 && focusAnchor && tree && focusId < tree.n && !inert
      ? { id: focusId, anchor: focusAnchor }
      : null;
  const cover = sheet || selected >= 0 ? CARD_RESERVE : 0;
  const showLegend = size.w >= 440 && size.h >= 300 && !sheet;
  const treeFocused = focusId >= 0;

  return (
    <section
      aria-label="Canopy"
      aria-busy={loading}
      aria-describedby={summaryId}
      data-local-keys
      data-variant={variant}
      onKeyDown={(e) => {
        if (e.key === "Escape" && variant === "expanded" && !e.defaultPrevented) {
          e.preventDefault();
          collapse();
        }
      }}
      className="relative flex h-full min-h-0 flex-col bg-card text-foreground"
    >
      {variant !== "compact" && <CanopyHeader variant={variant} onClose={sheet ? onClose : collapse} />}

      <div ref={stageRef} data-testid="canopy-stage" className="relative min-h-0 flex-1 overflow-hidden">
        {tree && theme && size.w > 0 && size.h > 0 && (
          <div className={cn("absolute inset-0 transition-opacity duration-200 motion-reduce:transition-none", (stale || status === "error") && "pointer-events-none opacity-50")}>
            <CanopyCanvas
              ref={canvasRef}
              tree={tree}
              theme={theme}
              width={size.w}
              height={size.h}
              inert={inert}
              focusId={treeFocused ? focusId : -1}
              selectedId={selected}
              lineIds={lineIds}
              reducedMotion={reduced}
              coverBottom={cover}
              onHover={onHover}
              onActivate={onActivate}
              onLayout={setLayout}
            />
          </div>
        )}

        {status === "refining" && <RefineBar />}

        {loading && <CanopyLoading />}
        {status === "error" && <CanopyError onRetry={retry} />}
        {noGames && tree && (
          <CanopyNoGames
            side={side}
            filterCount={filterCount}
            otherCount={otherCount}
            onOtherSide={() => setSide(other)}
            onClearFilters={clearFilters}
          />
        )}
        {outOfBook && <CanopyOutOfBook onBack={undo} onStart={toStart} />}

        {single && tree && <SingleGameNote tree={tree} onLoad={() => play(tree.firstChild[0])} />}

        {tree && (
          <CanopyTreeNav
            tree={tree}
            layout={layout}
            side={side}
            describedBy={summaryId}
            onFocusItem={setFocusId}
            onActivate={play}
            onZoom={(c) => (c === "in" ? canvasRef.current?.zoomIn() : c === "out" ? canvasRef.current?.zoomOut() : canvasRef.current?.fit())}
            onEscape={onEscape}
          />
        )}
        {!tree && <p id={summaryId} className="sr-only">{loading ? "Growing the canopy." : "No tree."}</p>}

        {tipTarget && tree && theme && (
          <CanopyTooltip
            key={`${tree.key}:${tipTarget.id}`}
            tree={tree}
            id={tipTarget.id}
            side={side}
            anchor={tipTarget.anchor}
            bounds={{ w: size.w, h: size.h }}
            hint={fine && !treeFocused ? (tree.kind[tipTarget.id] === LEAF ? "Click to load game" : "Click to play") : null}
          />
        )}

        <CanopyToolbar
          size={sheet ? "lg" : "md"}
          className="absolute top-2 right-2 z-20"
          onZoomIn={() => canvasRef.current?.zoomIn()}
          onZoomOut={() => canvasRef.current?.zoomOut()}
          onFit={() => canvasRef.current?.fit()}
          onExpand={variant === "compact" ? expand : undefined}
          expandLabel={lg ? "Expand" : "Full screen"}
        />

        {treeFocused ? (
          <p className="pointer-events-none absolute bottom-2 left-3 z-20 inline-flex h-6 items-center rounded-md border bg-card/90 px-2 text-[11px] text-muted-foreground backdrop-blur-sm">
            ↑↓ siblings · → deeper · ← back · Enter play
          </p>
        ) : (
          showLegend && tree && !noGames && !outOfBook && <CanopyLegend className="absolute bottom-3 left-3 z-10" />
        )}

        {selected >= 0 && tree && selected < tree.n && (
          <CanopySelectionCard tree={tree} id={selected} side={side} onPlay={() => play(selected)} onClear={() => setSelected(-1)} />
        )}
      </div>
    </section>
  );
}

function RefineBar() {
  return (
    <div aria-hidden data-testid="canopy-refining" className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden">
      <div className="canopy-refine h-full w-1/3 bg-primary/40 motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
}

function SingleGameNote({ tree, onLoad }: { tree: CanopyTree; onLoad: () => void }) {
  void tree;
  return (
    <div className="absolute top-2 left-3 z-20 flex h-8 items-center gap-2 text-xs text-muted-foreground">
      <span>Only one game reached this position</span>
      <Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={onLoad}>
        Load game
      </Button>
    </div>
  );
}
