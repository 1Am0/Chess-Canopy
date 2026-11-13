"use client";
import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { PaperClip } from "@/components/paper/PaperClip";
import { cn } from "@/lib/utils";

/*
 * A ruler card with a paper clip on it. The strip is a cream card with a hairline edge and printed ticks (20
 * divisions); the value is the clip clamped onto it, and the range is a thick primary ink line along the scale.
 * Radix keyboard and pointer behaviour is untouched. The clip pokes a few px above the strip (decoration only).
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex h-6 w-full touch-none items-center border border-rule-strong/60 bg-sheet-flat/70 select-none [background-image:var(--sheet-tile)] shadow-[inset_0_1px_2px_color-mix(in_oklab,var(--shadow-ink)_12%,transparent)] data-[disabled]:opacity-50 forced-colors:border-[ButtonText]",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="ticks pointer-events-none absolute inset-x-0 bottom-0 h-2 [--tick-color:var(--foreground)] [--tick-gap:5%]" />
      <SliderPrimitive.Track className="relative mb-1 h-[3px] w-full grow rounded-full bg-rule-strong/70">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary data-[orientation=horizontal]:h-[3px]" />
      </SliderPrimitive.Track>
      {values.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="group/thumb relative block h-6 w-3 shrink-0 outline-none before:absolute before:-inset-x-3 before:-inset-y-1.5 before:content-[''] pointer-coarse:before:-inset-x-4 pointer-coarse:before:-inset-y-2.5 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          <PaperClip className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[56%] transition-transform group-active/thumb:translate-y-[-52%]" angle={i % 2 ? 4 : -3} />
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
