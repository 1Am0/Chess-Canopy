"use client";

import { useEffect, useState, type RefObject } from "react";
import { createColorParser, readCanopyTheme, type CanopyTheme } from "@/lib/canopy/theme";

/**
 * The canopy palette, read once per theme change (next-themes toggles `.dark` on <html>),
 * never per frame. Fonts come from probe elements carrying the `font-mono` / `font-sans`
 * classes; the mono face is loaded on demand, so the theme is re-read when it arrives.
 */
export function useCanopyTheme(ref: RefObject<HTMLElement | null>): CanopyTheme | null {
  const [theme, setTheme] = useState<CanopyTheme | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parse = createColorParser();
    const probe = (cls: string) => {
      const s = document.createElement("span");
      s.className = cls;
      s.setAttribute("aria-hidden", "true");
      s.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
      el.appendChild(s);
      const f = getComputedStyle(s).fontFamily;
      s.remove();
      return f;
    };
    let alive = true;
    const read = () => {
      if (!alive) return;
      try {
        setTheme(readCanopyTheme(el, parse, { mono: probe("font-mono"), sans: probe("font-sans") }));
      } catch {
        /* stays on the previous theme */
      }
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    const mono = probe("font-mono");
    void document.fonts?.load(`500 11px ${mono}`).then(read, () => {});
    return () => {
      alive = false;
      mo.disconnect();
    };
  }, [ref]);

  return theme;
}
