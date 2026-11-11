"use client";
import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

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
        "relative flex h-6 w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="ticks pointer-events-none absolute inset-x-0 bottom-0 h-2 [--tick-gap:5%]"
      />
      <SliderPrimitive.Track className="relative h-[2px] w-full grow bg-rule-strong">
        <SliderPrimitive.Range className="absolute h-full bg-primary data-[orientation=horizontal]:h-[2px]" />
      </SliderPrimitive.Track>
      {values.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="relative block size-3.5 shrink-0 rounded-[1px] border-[1.5px] border-primary bg-card outline-none before:absolute before:-inset-2 before:content-[''] focus-visible:ring-4 focus-visible:ring-ring/50"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
