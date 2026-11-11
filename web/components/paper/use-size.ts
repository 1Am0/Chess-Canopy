"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Measures an element's content box (rounded to whole pixels) so pixel-exact generated
 * shapes can be drawn for it. Returns null until the first measurement; decorative
 * consumers render nothing until then, so nothing flashes and no layout is affected.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}
