import { expect, test, type Locator, type Page } from "@playwright/test";
import { importJsonFile, mockApis, STABILITY_GAMES_JSON } from "./helpers";

/**
 * Layout-stability regression test (Lichess / chess.com style): the board, bars, strips,
 * toolbar and every workspace slot must keep their position and size while moves are
 * played, undone, the side is switched, filters are applied and tabs are changed.
 */

type Rect = { x: number; y: number; w: number; h: number };
type Snapshot = Record<string, Rect | null>;
const TOLERANCE = 1;

async function rectOf(loc: Locator): Promise<Rect | null> {
  if ((await loc.count()) === 0 || !(await loc.first().isVisible())) return null;
  return loc.first().evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { x: b.left + window.scrollX, y: b.top + window.scrollY, w: b.width, h: b.height };
  });
}

function targets(page: Page): Record<string, Locator> {
  const aside = page.getByRole("complementary", { name: "Explorer" });
  const table = page.getByTestId("move-table-scroller");
  return {
    board: page.getByTestId("board"),
    stripTop: page.getByTestId("strip-top"),
    stripBottom: page.getByTestId("strip-bottom"),
    toolbar: page.getByRole("group", { name: "Board controls" }),
    sideSwitch: page.getByLabel("Side to view"),
    openingHeader: aside.locator("[data-slot=opening-header]"),
    filterRow: page.locator("[data-slot=filter-row]"),
    linePanel: page.getByRole("region", { name: "Line" }),
    summary: page.getByRole("region", { name: "Position summary" }),
    tabBar: page.getByRole("tablist", { name: "Explorer views" }),
    explorerRegion: page.getByTestId("explorer-region"),
    tableScroller: table,
    tableHeader: table.locator("thead"),
  };
}

const snapshot = async (page: Page, keys?: string[]): Promise<Snapshot> => {
  const t = targets(page);
  const out: Snapshot = {};
  for (const k of keys ?? Object.keys(t)) out[k] = await rectOf(t[k]);
  return out;
};

function assertStable(label: string, base: Snapshot, now: Snapshot) {
  for (const [k, b] of Object.entries(base)) {
    if (!b) continue;
    const n = now[k];
    expect(n, `${label}: ${k} disappeared`).not.toBeNull();
    for (const f of ["x", "y", "w", "h"] as const) {
      expect(Math.abs(n![f] - b[f]), `${label}: ${k}.${f} moved from ${b[f].toFixed(1)} to ${n![f].toFixed(1)}`).toBeLessThanOrEqual(TOLERANCE);
    }
  }
}

const lineLength = (page: Page) => new URL(page.url()).searchParams.get("line")?.split(",").filter(Boolean).length ?? 0;

/** Wait until no result is pending (tables and summary are not aria-busy), then let transitions end. */
async function settle(page: Page) {
  const t = targets(page);
  await expect(t.summary).toHaveAttribute("aria-busy", "false");
  if (await t.tableScroller.isVisible()) await expect(t.tableScroller.getByRole("grid")).toHaveAttribute("aria-busy", "false");
  await page.waitForTimeout(250);
}

async function viewAsWhite(page: Page) {
  const white = page.getByRole("radio", { name: "View games as White" });
  await white.click();
  await expect(white).toBeChecked();
  await settle(page);
}

for (const vp of [
  { name: "desktop 1440x900", width: 1440, height: 900 },
  { name: "laptop 1280x720", width: 1280, height: 720 },
]) {
  test.describe(`layout stability: ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test.beforeEach(async ({ context }) => {
      await mockApis(context);
    });

    test("workspace slots keep their rects across moves, undo, side, filters and tabs", async ({ page }) => {
      test.setTimeout(90_000);
      await importJsonFile(page, STABILITY_GAMES_JSON, "tester");
      await viewAsWhite(page);
      await page.evaluate(() => window.scrollTo(0, 0));

      const base = await snapshot(page);
      // Sanity: the elements we guard really exist on desktop.
      for (const k of ["board", "stripTop", "stripBottom", "toolbar", "sideSwitch", "openingHeader", "filterRow", "linePanel", "summary", "tabBar", "tableScroller", "tableHeader"]) {
        expect(base[k], `baseline ${k} missing`).not.toBeNull();
      }
      const check = async (label: string, keys?: string[]) => {
        await settle(page);
        const now = await snapshot(page, keys);
        const b = keys ? Object.fromEntries(keys.map((k) => [k, base[k]])) : base;
        assertStable(label, b, now);
      };
      const table = targets(page).tableScroller;

      // 1. Play at least 10 plies by clicking the top move row.
      for (let ply = 1; ply <= 12; ply++) {
        const row = table.locator("tbody tr[id^=move-row-]").first();
        await expect(row).toBeVisible();
        await row.click();
        await expect.poll(() => lineLength(page)).toBe(ply);
        await check(`after ply ${ply}`);
      }

      // 2. Step back with ArrowLeft.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      for (let k = 1; k <= 12; k++) {
        await page.keyboard.press("ArrowLeft");
        await check(`after ArrowLeft ${k}`);
      }
      await page.keyboard.press("ArrowRight");
      await check("after ArrowRight");

      // 3. Side switch Black / White (the line is kept).
      const line = lineLength(page);
      await page.getByRole("radio", { name: "View games as Black" }).click();
      await expect(page.getByRole("radio", { name: "View games as Black" })).toBeChecked();
      await check("side -> Black");
      expect(lineLength(page)).toBe(line);
      await viewAsWhite(page);
      await check("side -> White");

      // 4. Result filter apply + clear.
      await page.getByRole("button", { name: "Add filter" }).click();
      await page.getByRole("radiogroup", { name: "Result" }).getByRole("radio", { name: "Win" }).click();
      await page.getByRole("button", { name: "Done" }).click();
      await expect(page.getByLabel("Active filters").getByText("Result: Win")).toBeVisible();
      await check("filter applied");
      await page.getByRole("button", { name: "Remove filter Result: Win" }).click();
      await expect(page.getByLabel("Active filters")).toHaveCount(0);
      await check("filter cleared");

      // 5. Moves <-> Games tabs. The table slots only exist on the Moves tab.
      const noTable = Object.keys(base).filter((k) => k !== "tableScroller" && k !== "tableHeader");
      await page.getByRole("tab", { name: "Games" }).click();
      await check("tab Games", noTable);
      await page.getByRole("tab", { name: "Moves" }).click();
      await check("tab Moves");
    });
  });
}

test.describe("layout stability: mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ context }) => {
    await mockApis(context);
  });

  test("board, toolbar, side switch and tab bar stay put; tab switches keep the page height", async ({ page }) => {
    await importJsonFile(page, STABILITY_GAMES_JSON, "tester");
    await viewAsWhite(page);
    await page.evaluate(() => window.scrollTo(0, 0));

    const keys = ["board", "toolbar", "sideSwitch", "tabBar"];
    const base = await snapshot(page, keys);
    for (const k of keys) expect(base[k], `baseline ${k} missing`).not.toBeNull();
    const docHeight = () => page.evaluate(() => document.documentElement.scrollHeight);
    const h0 = await docHeight();

    // Switching tabs: the page height must not change at all.
    for (const tab of ["Games", "Moves", "Games", "Moves"]) {
      await page.getByRole("tab", { name: tab }).click();
      await settle(page);
      assertStable(`tab ${tab}`, base, await snapshot(page, keys));
      expect(Math.abs((await docHeight()) - h0), `tab ${tab} changed the document height`).toBeLessThanOrEqual(TOLERANCE);
    }

    // Playing moves keeps the board and bars in place (document coordinates; the page may scroll).
    const table = targets(page).tableScroller;
    for (let ply = 1; ply <= 3; ply++) {
      await table.locator("tbody tr[id^=move-row-]").first().click();
      await expect.poll(() => lineLength(page)).toBe(ply);
      await settle(page);
      assertStable(`ply ${ply}`, base, await snapshot(page, keys));
    }
    const h1 = await docHeight();
    for (const tab of ["Games", "Moves"]) {
      await page.getByRole("tab", { name: tab }).click();
      await settle(page);
      assertStable(`tab ${tab} after moves`, base, await snapshot(page, keys));
      expect(Math.abs((await docHeight()) - h1), `tab ${tab} changed the document height after moves`).toBeLessThanOrEqual(TOLERANCE);
    }
  });
});
