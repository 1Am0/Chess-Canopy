import { expect, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
export const SAMPLE_JSON = path.join(root, "tests/fixtures/golden/sample_games.json");
const chesscomGame = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/api/chesscom_game.json"), "utf8"));
const lichessGame = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/api/lichess_game.json"), "utf8"));

/** Mock chess.com + lichess (context-level so requests from the worker are caught too). */
export async function mockApis(ctx: BrowserContext, delayMs = 0) {
  const wait = () => (delayMs ? new Promise((r) => setTimeout(r, delayMs)) : Promise.resolve());
  await ctx.route("https://api.chess.com/**", async (route) => {
    await wait();
    const url = route.request().url();
    const headers = { "access-control-allow-origin": "*" };
    if (url.endsWith("/games/archives")) {
      const user = url.split("/player/")[1].split("/")[0];
      return route.fulfill({ json: { archives: [`https://api.chess.com/pub/player/${user}/games/2024/03`] }, headers });
    }
    if (/\/games\/\d{4}\/\d{2}$/.test(url)) return route.fulfill({ json: { games: [chesscomGame] }, headers });
    return route.fulfill({ status: 404, body: "", headers });
  });
  await ctx.route("https://lichess.org/api/**", async (route) => {
    await wait();
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(lichessGame) + "\n",
    });
  });
}

/** Larger synthetic fixture: 40 White games, with 3 rare first-level moves (c4, Nf3, b3). */
export const MANY_GAMES_JSON = path.join(root, "e2e/fixtures/many_games.json");

export async function importJsonFile(page: Page, file: string, username = "tester") {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your openings/ })).toBeVisible();
  await page.getByRole("tab", { name: "JSON" }).click();
  await page.getByLabel("Drop a JSON file exported by the Python CLI").setInputFiles(file);
  await page.getByLabel(/Player label/).fill(username);
  await page.getByRole("button", { name: "Import games" }).click();
  await expect(page.getByRole("table")).toBeVisible();
}

export async function importSampleJson(page: Page, username = "tester") {
  await importJsonFile(page, SAMPLE_JSON, username);
}

export const moveRow = (page: Page, san: string) => page.getByRole("row").filter({ has: page.getByText(san, { exact: true }) });
