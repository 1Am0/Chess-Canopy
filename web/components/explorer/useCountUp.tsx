"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Eases a displayed integer toward `target` over ~300ms whenever the target changes. The first
 * render shows the target directly, and with reduced motion the change is immediate.
 */
export function useCountUp(target: number, ms = 300): number {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (current.current === target) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    if (reduce) {
      raf = requestAnimationFrame(() => {
        current.current = target;
        setShown(target);
      });
      return () => cancelAnimationFrame(raf);
    }
    const from = current.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - t) ** 3;
      const v = t >= 1 ? target : Math.round(from + (target - from) * eased);
      current.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

/** A number that counts to its new value; `format` renders each step. */
export function CountUp({ value, format = String }: { value: number; format?: (n: number) => string }) {
  return <>{format(useCountUp(value))}</>;
}
