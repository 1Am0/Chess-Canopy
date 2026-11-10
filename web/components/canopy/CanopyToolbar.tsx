"use client";

import { Info, Maximize2, Scan, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CanopyKey } from "@/components/canopy/CanopyLegend";
import { cn } from "@/lib/utils";

function Tool({ label, hint, onClick, children, big }: { label: string; hint: string; onClick?: () => void; children: React.ReactNode; big: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={label}
          onClick={onClick}
          className={cn("rounded-[5px] text-muted-foreground hover:text-foreground", big ? "size-10" : "size-8")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Top-right overlay: zoom in / out, fit, key, and (compact only) expand. Plain icon buttons on
 * a hairline card so the tree stays the subject.
 */
export function CanopyToolbar({
  size = "md",
  onZoomIn,
  onZoomOut,
  onFit,
  onExpand,
  expandLabel = "Expand",
  className,
}: {
  size?: "md" | "lg";
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  /** Compact view only. */
  onExpand?: () => void;
  expandLabel?: "Expand" | "Full screen";
  className?: string;
}) {
  const big = size === "lg";
  return (
    <div
      role="toolbar"
      aria-label="Canopy view"
      data-testid="canopy-toolbar"
      className={cn("flex items-center gap-0.5 rounded-md border bg-card/85 p-0.5 backdrop-blur-sm", className)}
    >
      <Tool big={big} label="Zoom in" hint="Zoom in (+)" onClick={onZoomIn}>
        <ZoomIn />
      </Tool>
      <Tool big={big} label="Zoom out" hint="Zoom out (-)" onClick={onZoomOut}>
        <ZoomOut />
      </Tool>
      <Tool big={big} label="Fit to view" hint="Fit (0)" onClick={onFit}>
        <Scan />
      </Tool>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                aria-label="How to read the canopy"
                className={cn("rounded-[5px] text-muted-foreground hover:text-foreground data-[state=open]:bg-accent", big ? "size-10" : "size-8")}
              >
                <Info />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">How to read this</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-72 p-3.5">
          <CanopyKey />
        </PopoverContent>
      </Popover>
      {onExpand && (
        <>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          <Tool big={big} label={expandLabel} hint={expandLabel} onClick={onExpand}>
            <Maximize2 />
          </Tool>
        </>
      )}
    </div>
  );
}
