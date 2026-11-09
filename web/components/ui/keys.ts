import type { KeyboardEvent } from "react";

const NAV_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

/**
 * Composite widgets (tab lists, toggle groups, menus) use the arrow keys to move focus.
 * The window-level shortcuts use the same keys to step through the line, so the widget
 * stops these key presses from bubbling past it: React's stopPropagation also stops the
 * native event before it reaches `window`.
 */
export function keepNavKeysLocal<E extends KeyboardEvent>(e: E): void {
  if (NAV_KEYS.has(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) e.stopPropagation();
}
