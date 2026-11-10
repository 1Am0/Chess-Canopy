"use client";

import { useId, useMemo, useState } from "react";
import type { Color } from "@/lib/engine/types";
import type { CanopyTree } from "@/lib/canopy/types";
import type { CanopyLayout } from "@/lib/canopy/layout";
import { relPath } from "@/lib/canopy/labels";
import { isNavigable, nodeName, treeSummary } from "@/components/canopy/info";

const MAX_ITEMS = 400;

interface Item {
  id: number;
  key: string;
  level: number;
  size: number;
  pos: number;
  parent: string | null;
  hasKids: boolean;
}

export function itemKey(t: CanopyTree, i: number): string {
  const p = relPath(t, i).join(" ");
  return t.san[i] === "" ? `${p}#${t.leafRef[i]}` : p;
}

function kids(t: CanopyTree, i: number): number[] {
  const out: number[] = [];
  const c = t.firstChild[i];
  if (c < 0) return out;
  for (let j = c; j < c + t.childCount[i]; j++) if (isNavigable(t, j)) out.push(j);
  return out;
}

/** Visible items in reading order (a depth-first walk of the expanded part of the tree). */
function visibleItems(t: CanopyTree, expanded: ReadonlySet<string>, x: Float32Array | null): Item[] {
  const out: Item[] = [];
  const walk = (parentId: number, parentKey: string | null, level: number) => {
    const ids = kids(t, parentId);
    if (x) ids.sort((a, b) => x[a] - x[b]);
    for (let n = 0; n < ids.length; n++) {
      if (out.length >= MAX_ITEMS) return;
      const id = ids[n];
      const key = itemKey(t, id);
      const k = kids(t, id).length;
      out.push({ id, key, level, size: ids.length, pos: n + 1, parent: parentKey, hasKids: k > 0 });
      if (k > 0 && expanded.has(key)) walk(id, key, level + 1);
    }
  };
  walk(0, null, 1);
  return out;
}

/**
 * The accessible face of the canvas: a tree (APG pattern) of the lines from this position.
 * The tree keeps DOM focus and points at its current item with aria-activedescendant, so a
 * re-root after Enter never drops the focus. Visually hidden; the focused item is mirrored on
 * the canvas by the parent.
 */
export function CanopyTreeNav({
  tree,
  layout,
  side,
  onFocusItem,
  onActivate,
  onZoom,
  onEscape,
  describedBy,
}: {
  tree: CanopyTree;
  layout: CanopyLayout | null;
  side: Color;
  /** The id of the focused item, or -1 when the tree lost focus. */
  onFocusItem: (id: number) => void;
  onActivate: (id: number) => void;
  onZoom: (cmd: "in" | "out" | "fit") => void;
  /** Return true when Esc was used (the key is then consumed). */
  onEscape: () => boolean;
  describedBy: string;
}) {
  const uid = useId();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [seenRoot, setSeenRoot] = useState(tree.path.join(" "));
  const rootKey = tree.path.join(" ");
  if (seenRoot !== rootKey) {
    setSeenRoot(rootKey);
    setExpanded(new Set());
    setFocusKey(null);
  }

  const items = useMemo(() => visibleItems(tree, expanded, layout?.x ?? null), [tree, expanded, layout]);
  const cur = items.find((it) => it.key === focusKey) ?? items[0] ?? null;

  const focus = (it: Item | undefined | null) => {
    if (!it) return;
    setFocusKey(it.key);
    onFocusItem(it.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    switch (e.key) {
      case "+":
      case "=":
        handled();
        return onZoom("in");
      case "-":
      case "_":
        handled();
        return onZoom("out");
      case "0":
        handled();
        return onZoom("fit");
      case "Escape":
        if (onEscape()) handled();
        return;
    }
    if (!cur) return;
    const sibs = items.filter((it) => it.parent === cur.parent);
    switch (e.key) {
      case "ArrowDown":
        handled();
        focus(sibs[Math.min(sibs.indexOf(cur) + 1, sibs.length - 1)]);
        break;
      case "ArrowUp":
        handled();
        focus(sibs[Math.max(sibs.indexOf(cur) - 1, 0)]);
        break;
      case "Home":
        handled();
        focus(sibs[0]);
        break;
      case "End":
        handled();
        focus(sibs[sibs.length - 1]);
        break;
      case "ArrowRight": {
        if (!cur.hasKids) return handled();
        handled();
        if (!expanded.has(cur.key)) {
          setExpanded(new Set(expanded).add(cur.key));
        } else {
          // Most popular child first: the tree is stored games-descending.
          focus(kids(tree, cur.id).map((id) => items.find((it) => it.id === id)).find(Boolean));
        }
        break;
      }
      case "ArrowLeft": {
        if (expanded.has(cur.key)) {
          handled();
          const next = new Set(expanded);
          next.delete(cur.key);
          setExpanded(next);
        } else if (cur.parent !== null) {
          handled();
          focus(items.find((it) => it.key === cur.parent));
        }
        // At the first level the key falls through: the board steps back (and the canopy re-roots).
        break;
      }
      case "Enter":
      case " ":
        handled();
        onActivate(cur.id);
        break;
    }
  };

  return (
    <>
      <p id={describedBy} className="sr-only">
        {treeSummary(tree)}
      </p>
      <ul
        role="tree"
        data-testid="canopy-tree"
        aria-label="Canopy: lines from this position"
        aria-activedescendant={cur ? `${uid}-${items.indexOf(cur)}` : undefined}
        tabIndex={items.length ? 0 : -1}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          if (e.target === e.currentTarget) focus(cur);
        }}
        onBlur={(e) => {
          if (e.target === e.currentTarget) onFocusItem(-1);
        }}
        className="sr-only"
      >
        {items.map((it, n) => (
          <li
            key={it.key}
            id={`${uid}-${n}`}
            role="treeitem"
            aria-level={it.level}
            aria-setsize={it.size}
            aria-posinset={it.pos}
            aria-expanded={it.hasKids ? expanded.has(it.key) : undefined}
            aria-selected={cur?.key === it.key}
          >
            {nodeName(tree, it.id, side)}
          </li>
        ))}
      </ul>
    </>
  );
}
