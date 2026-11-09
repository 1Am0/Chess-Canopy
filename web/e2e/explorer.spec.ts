import { expect, test } from "@playwright/test";
import { importSampleJson, mockApis, moveRow } from "./helpers";

test.beforeEach(async ({ context }) => {
  await mockApis(context);
});

test("onboarding -> JSON import shows move table and game count", async ({ page }) => {
  await importSampleJson(page);
  await expect(page.getByRole("button", { name: /Players:/ })).toContainText("3");
  await expect(page.getByRole("region", { name: "Position summary" })).toContainText("2");
  await expect(moveRow(page, "e4")).toBeVisible();
  await expect(moveRow(page, "d4")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Explorer" }).getByText("Starting position")).toBeVisible();
});

test("move click updates line, trail, opening; keyboard nav; reload persists", async ({ page }) => {
  await importSampleJson(page);
  await moveRow(page, "e4").click();
  await expect(page).toHaveURL(/line=e4$/);
  await expect(page.getByRole("navigation", { name: "Move trail" })).toContainText("e4");
  await expect(page.getByRole("navigation", { name: "Opening" })).toContainText(/King's Pawn/i);
  await expect(moveRow(page, "e5")).toBeVisible();
  await moveRow(page, "e5").click();
  await expect(page).toHaveURL(/line=e4,e5$/);

  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/line=e4$/);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/line=e4,e5$/);

  const board = page.getByLabel("Chess board");
  const before = await board.locator("[data-square='a1']").first().boundingBox();
  await page.keyboard.press("f");
  await expect.poll(async () => (await board.locator("[data-square='a1']").first().boundingBox())?.y).not.toBe(before?.y);

  await page.reload();
  await expect(page).toHaveURL(/line=e4,e5$/);
  await expect(page.getByRole("navigation", { name: "Move trail" })).toContainText("e5");
  await expect(page.getByRole("button", { name: /Players:/ })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
});

test("result filter adds chip, changes counts, removable", async ({ page }) => {
  await importSampleJson(page);
  const summary = page.getByRole("region", { name: "Position summary" });
  await expect(summary).toContainText(/2\s*games here/);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByRole("radiogroup", { name: "Result" }).getByRole("radio", { name: "Win" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  const chips = page.getByLabel("Active filters");
  await expect(chips.getByText("Result: Win")).toBeVisible();
  await expect(summary).toContainText(/\b1\s*game here/);
  await expect(moveRow(page, "d4")).toHaveCount(0);
  await page.getByRole("button", { name: "Remove filter Result: Win" }).click();
  await expect(chips).toHaveCount(0);
  await expect(summary).toContainText(/2\s*games here/);
  await expect(moveRow(page, "d4")).toBeVisible();
});

test("chess.com import (mocked) shows progress and adds a player", async ({ page, context }) => {
  await context.unrouteAll();
  await mockApis(context, 700);
  await page.goto("/");
  await page.getByRole("tab", { name: "Chess.com" }).click();
  await page.getByLabel("Username").fill("Hero");
  await page.getByRole("button", { name: "Import games" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText(/Imported 1 new games/)).toBeVisible();
  await page.getByRole("button", { name: /Players:/ }).click();
  await expect(page.getByRole("checkbox", { name: "Hero" })).toBeVisible();
});

test("lichess import (mocked NDJSON) adds a second player", async ({ page }) => {
  await importSampleJson(page);
  await page.getByRole("button", { name: "Import games" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("tab", { name: "Lichess" }).click();
  await dlg.getByLabel("Username").fill("Hero");
  await dlg.getByRole("button", { name: "Import games" }).click();
  await expect(page.getByText(/Imported 1 new games/)).toBeVisible();
  await page.getByRole("button", { name: /Players:/ }).click();
  await expect(page.getByRole("checkbox", { name: "Hero" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "tester" })).toBeVisible();
});

test("import error shows a friendly message", async ({ page, context }) => {
  await context.route("https://api.chess.com/**", (r) => r.fulfill({ status: 404, body: "", headers: { "access-control-allow-origin": "*" } }));
  await page.goto("/");
  await page.getByRole("tab", { name: "Chess.com" }).click();
  await page.getByLabel("Username").fill("nobody");
  await page.getByRole("button", { name: "Import games" }).click();
  await expect(page.getByText("Player not found on Chess.com")).toBeVisible();
});

test("deleting the last player returns to Welcome", async ({ page }) => {
  await importSampleJson(page);
  await page.getByRole("button", { name: /Players:/ }).click();
  await page.getByRole("button", { name: /Manage players/ }).click();
  await page.getByRole("button", { name: "Delete tester" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: /Your openings/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /Your openings/ })).toBeVisible();
});

test("mobile viewport: no horizontal scroll, board visible, tabs switch", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your openings/ })).toBeVisible();
  expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= window.innerWidth)).toBe(true);
  await importSampleJson(page);
  expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByLabel("Chess board")).toBeVisible();
  await page.getByRole("tab", { name: "Games" }).click();
  await expect(page.getByText("Recent games here")).toBeVisible();
  await expect(page.getByRole("table")).toBeHidden();
  await page.getByRole("tab", { name: "Moves" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= window.innerWidth)).toBe(true);
});

test("persisted selection of an unknown player falls back to all", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("chess-canopy:v1"))
      localStorage.setItem("chess-canopy:v1", JSON.stringify({ state: { selected: ["lichess:ghost"], filters: {} }, version: 0 }));
  });
  await importSampleJson(page);
  await expect(page.getByRole("button", { name: /Players: All players/ })).toBeVisible();
  await expect(moveRow(page, "e4")).toBeVisible();
});
