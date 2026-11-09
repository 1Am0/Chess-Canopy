import { defineConfig } from "@playwright/test";

// Chromium is preinstalled at /opt/pw-browsers/chromium in the sandbox; set
// PW_CHROMIUM_PATH to use it if the bundled browser version does not match.
const executablePath = process.env.PW_CHROMIUM_PATH;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  // `pnpm start` serves out/ with web/serve.json, i.e. the same CSP headers as vercel.json.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "off",
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3100",
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
