import { defineConfig } from "@playwright/test";

// Chromium is preinstalled at /opt/pw-browsers/chromium in the sandbox; set
// PW_CHROMIUM_PATH to use it if the bundled browser version does not match.
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "off",
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
