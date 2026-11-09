import { expect, test } from "@playwright/test";
import { importJsonFile, importSampleJson, MANY_GAMES_JSON, mockApis, moveRow, trackCspViolations } from "./helpers";
import path from "node:path";

const PGN_SAMPLE = path.join(process.cwd(), "tests/fixtures/golden/sample.pgn");

test.beforeEach(async ({ context }) => {
  await mockApis(context);
});

test("onboarding -> JSON import shows move table and game count", async ({ page }) => {
  const csp = await trackCspViolations(page);
  await importSampleJson(page);
  await expect(page.getByRole("button", { name: /Players:/ })).toContainText("3");
  await expect(page.getByRole("region", { name: "Position summary" })).toContainText("2");
  await expect(moveRow(page, "e4")).toBeVisible();
  await expect(moveRow(page, "d4")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Explorer" }).getByText("Starting position")).toBeVisible();
  expect(csp.violations).toEqual([]);
});

test("PGN import (username Hero) shows move rows in the explorer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your openings/ })).toBeVisible();
  await page.getByRole("tab", { name: "PGN" }).click();
  await page.getByLabel("Drop a .pgn file here").setInputFiles(PGN_SAMPLE);
  await page.getByLabel("Your username in these games").fill("Hero");
  await page.getByRole("button", { name: "Import games" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  // Explorer trees are per color: at the start (White to move) only Hero's White game counts.
  await expect(moveRow(page, "e4")).toBeVisible();
  await expect(page.getByRole("region", { name: "Position summary" })).toContainText(/\b1\s*game\b/);
  await expect(page.getByRole("complementary", { name: "Explorer" }).getByText("Starting position")).toBeVisible();
});

test("move click updates line, line panel, opening; keyboard nav; reload persists", async ({ page }) => {
  await importSampleJson(page);
  await moveRow(page, "e4").click();
  await expect(page).toHaveURL(/line=e4$/);
  await expect(page.getByRole("region", { name: "Line" })).toContainText("e4");
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
  await expect(page.getByRole("region", { name: "Line" })).toContainText("e5");
  await expect(page.getByRole("button", { name: /Players:/ })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
});

test("result filter adds chip, changes counts, removable", async ({ page }) => {
  await importSampleJson(page);
  const summary = page.getByRole("region", { name: "Position summary" });
  await expect(summary).toContainText(/\b2\s*games\b/);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByRole("radiogroup", { name: "Result" }).getByRole("radio", { name: "Win" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  const chips = page.getByLabel("Active filters");
  await expect(chips.getByText("Result: Win")).toBeVisible();
  await expect(summary).toContainText(/\b1\s*game\b/);
  await expect(moveRow(page, "d4")).toHaveCount(0);
  await page.getByRole("button", { name: "Remove filter Result: Win" }).click();
  await expect(chips).toHaveCount(0);
  await expect(summary).toContainText(/\b2\s*games\b/);
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

test("side switch keeps the line, flips board and player strip; White switches back", async ({ page }) => {
  await importSampleJson(page);
  const black = page.getByRole("radio", { name: "View games as Black" });
  const white = page.getByRole("radio", { name: "View games as White" });
  await expect(white).toBeChecked();

  await moveRow(page, "e4").click();
  await expect(page).toHaveURL(/line=e4$/);

  await black.click();
  await expect(black).toBeChecked();
  await expect(white).not.toBeChecked();
  // The line is kept: only the side and board orientation change.
  await expect(page).toHaveURL(/line=e4/);

  // Board orientation follows the side: a1 is now at the top, and the bottom strip is "You · Black".
  const board = page.getByLabel("Chess board");
  const a1 = await board.locator("[data-square='a1']").first().boundingBox();
  const h8 = await board.locator("[data-square='h8']").first().boundingBox();
  expect(a1!.y).toBeLessThan(h8!.y);
  const you = page.getByText("You", { exact: true });
  await expect(you).toBeVisible();
  await expect(page.getByText(/^·\s*Black$/)).toBeVisible();
  const boardBox = await board.boundingBox();
  const youBox = await you.boundingBox();
  expect(youBox!.y).toBeGreaterThan(boardBox!.y + boardBox!.height);

  await white.click();
  await expect(white).toBeChecked();
  await expect(black).not.toBeChecked();
  await expect(page.getByText(/^·\s*White$/)).toBeVisible();
  const a1w = await board.locator("[data-square='a1']").first().boundingBox();
  const h8w = await board.locator("[data-square='h8']").first().boundingBox();
  expect(a1w!.y).toBeGreaterThan(h8w!.y);
});

test("filters sheet has no Color control", async ({ page }) => {
  await importSampleJson(page);
  await page.getByRole("button", { name: /^Filters/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radiogroup", { name: "Result" })).toBeVisible();
  await expect(dialog.getByRole("radiogroup", { name: /colou?r/i })).toHaveCount(0);
  await expect(dialog.getByText(/^Colou?r$/)).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /colou?r/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Done" }).click();
});

test("line panel lists moves with numbers; clicking a move rewinds; Reset returns to start", async ({ page }) => {
  await importSampleJson(page);
  await moveRow(page, "e4").click();
  await moveRow(page, "e5").click();
  await expect(page).toHaveURL(/line=e4,e5$/);

  const line = page.getByRole("region", { name: "Line" });
  await expect(line.getByRole("listitem").first()).toHaveText(/^1\s*e4\s*e5$/);
  await expect(line.getByRole("button", { name: "e5", exact: true })).toHaveAttribute("aria-current", "step");

  await line.getByRole("button", { name: "e4", exact: true }).click();
  await expect(page).toHaveURL(/line=e4$/);
  await expect(line.getByRole("button", { name: "e4", exact: true })).toHaveAttribute("aria-current", "step");
  // The undone move stays in the panel as the redo branch.
  await expect(line.getByRole("button", { name: "e5", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Reset to start" }).click();
  await expect(page).not.toHaveURL(/line=/);
  await expect(line.getByRole("button", { name: "Start", exact: true })).toHaveAttribute("aria-current", "step");
  await expect(line.getByRole("button", { name: "e4", exact: true })).not.toHaveAttribute("aria-current", "step");
});

test("rare moves collapse behind a toggle and expand on click", async ({ page }) => {
  await importJsonFile(page, MANY_GAMES_JSON, "tester");
  await expect(moveRow(page, "e4")).toBeVisible();
  await expect(moveRow(page, "d4")).toBeVisible();
  // Threshold is max(3, 1%) of 40 games = 3, so c4 (2), Nf3 (1) and b3 (1) are rare.
  await expect(moveRow(page, "c4")).toHaveCount(0);
  await expect(moveRow(page, "Nf3")).toHaveCount(0);
  await expect(moveRow(page, "b3")).toHaveCount(0);

  const show = page.getByRole("button", { name: "Show 3 rare moves" });
  await expect(show).toHaveAttribute("aria-expanded", "false");
  await show.click();
  await expect(page.getByRole("button", { name: "Hide 3 rare moves" })).toHaveAttribute("aria-expanded", "true");
  await expect(moveRow(page, "c4")).toBeVisible();
  await expect(moveRow(page, "Nf3")).toBeVisible();
  await expect(moveRow(page, "b3")).toBeVisible();

  await page.getByRole("button", { name: "Hide 3 rare moves" }).click();
  await expect(moveRow(page, "c4")).toHaveCount(0);
});

test("copy share link shows a Copied toast", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await importSampleJson(page);
  await moveRow(page, "e4").click();
  await page.getByRole("button", { name: "Copy share link" }).click();
  await expect(page.getByText("Copied", { exact: true })).toBeVisible();
  const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  expect(copied.searchParams.get("line")).toBe("e4");
  expect(copied.searchParams.get("side")).toBe("white");
});

test("mobile tabs: Moves / Line / Games switch content without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importSampleJson(page);
  const noHScroll = () => page.evaluate(() => document.scrollingElement!.scrollWidth <= window.innerWidth);
  const line = page.getByRole("region", { name: "Line" });

  await moveRow(page, "e4").click();
  await page.getByRole("tab", { name: "Line" }).click();
  await expect(line).toBeVisible();
  await expect(line.getByRole("button", { name: "e4", exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toBeHidden();
  expect(await noHScroll()).toBe(true);

  await page.getByRole("tab", { name: "Moves" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(line).toBeHidden();
  expect(await noHScroll()).toBe(true);

  await page.getByRole("tab", { name: "Games" }).click();
  await expect(page.getByText("Recent games here")).toBeVisible();
  await expect(page.getByRole("table")).toBeHidden();
  expect(await noHScroll()).toBe(true);
});
