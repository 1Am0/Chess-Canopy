import { expect, test, type Page } from "@playwright/test";
import { importSampleJson, mockApis, moveRow } from "./helpers";

test.beforeEach(async ({ context }) => {
  await mockApis(context);
});

const lineParam = (page: Page) => new URL(page.url()).searchParams.get("line");

test("arrow keys on the side switch move focus, not the line (H1)", async ({ page }) => {
  await importSampleJson(page);
  await moveRow(page, "e4").click();
  await expect(page).toHaveURL(/line=e4$/);

  const white = page.getByRole("radio", { name: "View games as White" });
  await white.focus();
  await page.keyboard.press("ArrowRight");
  expect(lineParam(page)).toBe("e4");
  await page.keyboard.press("ArrowLeft");
  expect(lineParam(page)).toBe("e4");

  // Outside of those widgets the arrow still steps through the line.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => lineParam(page)).toBeNull();
});

test("the board is one labelled image and its pieces are not tab stops (H2, L1)", async ({ page }) => {
  await importSampleJson(page);
  const board = page.getByTestId("board");
  await expect(board).toHaveAttribute("role", "img");
  await expect(board).toHaveAttribute("aria-label", /^Chess board\. Starting position, White to move$/);
  await moveRow(page, "e4").click();
  await expect(board).toHaveAttribute("aria-label", /Position after 1\.e4, Black to move/);
  await expect.poll(() => board.locator('[aria-roledescription="draggable"]').count()).toBeGreaterThan(0);
  await expect.poll(() => board.locator('[aria-roledescription="draggable"]:not([tabindex="-1"])').count()).toBe(0);
  await expect.poll(() => board.locator('[tabindex="0"]').count()).toBe(0);
  // One "Board" landmark only.
  await expect(page.getByRole("region", { name: "Board" })).toHaveCount(1);
});

test("the move table is a grid whose active row is only announced while it has focus (M8)", async ({ page }) => {
  await importSampleJson(page);
  const grid = page.getByRole("grid", { name: /^Candidate moves/ });
  await expect(grid).not.toHaveAttribute("aria-activedescendant", /.+/);
  await grid.focus();
  await expect(grid).toHaveAttribute("aria-activedescendant", "move-row-0");
  await page.keyboard.press("ArrowDown");
  await expect(grid).toHaveAttribute("aria-activedescendant", "move-row-1");
  await expect(page.locator("#move-row-1")).toHaveAttribute("aria-selected", "true");
});

test("one look only: no Appearance menu, light theme even when the system prefers dark (R4)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await importSampleJson(page);
  await expect(page.getByRole("button", { name: "Appearance" })).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  // The shortcuts help is reachable at every width.
  await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Arrow keys inside the dialog must not step through the line.
  await page.keyboard.press("ArrowDown");
  expect(lineParam(page)).toBeNull();
  await page.keyboard.press("Escape");
});

test("popovers and the opponent picker have names (L2, M8)", async ({ page }) => {
  await importSampleJson(page);
  await page.getByRole("button", { name: /^Players:/ }).click();
  await expect(page.getByRole("dialog", { name: "Choose players" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByRole("combobox", { name: "Opponent" }).click();
  await expect(page.getByRole("dialog", { name: "Opponents" })).toBeVisible();
});

test("320px: header controls do not overlap (H3)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await importSampleJson(page);
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll("header button")]
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { name: b.getAttribute("aria-label") ?? b.textContent ?? "", l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width };
      })
      .filter((x) => x.w > 0),
  );
  expect(boxes.length).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < boxes.length; i++) {
    expect(boxes[i].l, `${boxes[i].name} starts off-screen`).toBeGreaterThanOrEqual(0);
    expect(boxes[i].r, `${boxes[i].name} ends off-screen`).toBeLessThanOrEqual(320.5);
    for (let j = i + 1; j < boxes.length; j++) {
      const overlap = Math.min(boxes[i].r, boxes[j].r) - Math.max(boxes[i].l, boxes[j].l);
      expect(overlap, `${boxes[i].name} overlaps ${boxes[j].name}`).toBeLessThanOrEqual(0.5);
    }
  }
  expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= window.innerWidth)).toBe(true);
});

test("rating ranges are applied on blur and an inverted range is swapped (M5)", async ({ page }) => {
  await importSampleJson(page);
  await page.getByRole("button", { name: /^Filters/ }).click();
  const min = page.getByLabel("My rating minimum");
  const max = page.getByLabel("My rating maximum");
  await min.fill("2500");
  await max.fill("1000");
  await expect(min).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Min is above max")).toBeVisible();
  await max.blur();
  await expect(min).toHaveValue("1000");
  await expect(max).toHaveValue("2500");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByLabel("Active filters").getByText("My rating 1000–2500")).toBeVisible();
});

test("the viewed side is written to the address bar after a click (L15)", async ({ page }) => {
  await importSampleJson(page);
  await page.getByRole("radio", { name: "View games as Black" }).click();
  await expect(page).toHaveURL(/side=black/);
  await page.getByRole("radio", { name: "View games as White" }).click();
  await expect(page).toHaveURL(/side=white/);
});

test("closing the import dialog keeps progress and Cancel in the header (M1)", async ({ page, context }) => {
  await context.unrouteAll();
  await mockApis(context, 2500);
  await importSampleJson(page);
  await page.getByRole("button", { name: "Import games" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("tab", { name: "Chess.com" }).click();
  await dlg.getByLabel("Username").fill("Hero");
  await dlg.getByRole("button", { name: "Import games" }).click();
  await expect(dlg.getByRole("progressbar")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
  const chip = page.getByTestId("import-indicator");
  await expect(chip).toBeVisible();
  // Sync / Delete are unavailable while importing.
  await page.getByRole("button", { name: /^Players:/ }).click();
  await page.getByRole("button", { name: /Manage players/ }).click();
  await expect(page.getByRole("button", { name: "Delete tester" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(chip).toBeVisible();
  await chip.getByRole("button", { name: "Cancel import" }).click();
  await expect(page.getByText("Import cancelled")).toBeVisible();
  await expect(chip).toBeHidden();
});

test("the last selected player can't be unchecked (L14)", async ({ page }) => {
  await importSampleJson(page);
  await page.getByRole("button", { name: "Import games" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("tab", { name: "Lichess" }).click();
  await dlg.getByLabel("Username").fill("Hero");
  await dlg.getByRole("button", { name: "Import games" }).click();
  await expect(page.getByText(/Imported 1 new games/)).toBeVisible();
  await page.getByRole("button", { name: /^Players:/ }).click();
  await page.getByRole("checkbox", { name: "Hero" }).click(); // all -> only tester
  await expect(page.getByRole("checkbox", { name: "tester" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "tester" })).toBeChecked();
});

test("keyboard focus shows a visible outline on header buttons", async ({ page }) => {
  await importSampleJson(page);
  const header = page.getByRole("banner");
  let found = false;
  for (let i = 0; i < 40 && !found; i++) {
    await page.keyboard.press("Tab");
    found = await page.evaluate(() => {
      const el = document.activeElement;
      return !!el && el.tagName === "BUTTON" && !!el.closest("header");
    });
  }
  expect(found).toBe(true);
  const outline = await header.locator("button:focus-visible").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  expect(outline.style).toBe("solid");
  expect(outline.width).toBeGreaterThan(0);
});
