import { expect, test } from "@playwright/test";
import { importSampleJson, mockApis, trackCspViolations } from "./helpers";

// mockApis answers every lichess.org/api request with a game export, which the eval code reads as
// "no cloud evaluation for this position", so these tests exercise the in-browser Stockfish fallback.
test.beforeEach(async ({ context }) => {
  await mockApis(context);
});

test("eval bar falls back to Stockfish in the browser when the cloud has no evaluation", async ({ page }) => {
  const csp = await trackCspViolations(page);
  await importSampleJson(page);
  const bar = page.getByTestId("eval-bar");
  await expect(bar).toHaveAttribute("aria-label", /computed in your browser/, { timeout: 30_000 });
  const start = await bar.getAttribute("aria-label");
  expect(start).toMatch(/Stockfish evaluation [+-]?\d/);

  // an off-book position gets its own evaluation, and a quiet start is close to equal
  await page.goto("/?line=h4,e5,h5,f6");
  await expect(bar).toHaveAttribute("aria-label", /computed in your browser/, { timeout: 30_000 });
  expect(csp.violations).toEqual([]);
});
