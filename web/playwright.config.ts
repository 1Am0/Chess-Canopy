import { defineConfig } from "@playwright/test";

// Chromium is preinstalled at /opt/pw-browsers/chromium in the sandbox; set
// PW_CHROMIUM_PATH to use it if the bundled browser version does not match.
const executablePath = process.env.PW_CHROMIUM_PATH;
const isCI = !!process.env.CI;
// PW_PORT lets several checkouts run the suite at once without sharing a server.
const port = process.env.PW_PORT ?? "3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  // `pnpm start` serves out/ with web/serve.json, i.e. the same CSP headers as vercel.json.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "off",
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: port === "3100" ? "pnpm start" : `node scripts/sync-serve-headers.mjs && serve out -l ${port} --no-clipboard -c ../serve.json`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
