// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useKeyboardShortcuts } from "@/hooks/use-explorer-sync";
import { useExplorerStore } from "@/lib/store";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  useKeyboardShortcuts();
  return null;
}

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
});

describe("global keyboard shortcuts", () => {
  it("steps with the arrows but ignores keys a widget already handled (defaultPrevented)", () => {
    const el = document.createElement("div");
    root = createRoot(el);
    act(() => root!.render(createElement(Probe)));
    useExplorerStore.setState({ path: ["e4", "e5"], cursor: 2 });

    act(() => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", cancelable: true, bubbles: true }));
    });
    expect(useExplorerStore.getState().cursor).toBe(1);

    const handled = new KeyboardEvent("keydown", { key: "ArrowLeft", cancelable: true, bubbles: true });
    handled.preventDefault();
    act(() => {
      document.body.dispatchEvent(handled);
    });
    expect(useExplorerStore.getState().cursor).toBe(1);
  });
});
