import { defineConfig, devices } from "@playwright/test";

// Their own ports, so the tests never reuse the dev servers (8000, 5173) or their data.
const API_PORT = 8100;
const WEB_PORT = 5180;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

export default defineConfig({
  testDir: "e2e",
  // The tests share one database, so they run one at a time.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: `node e2e/start-api.mjs ${API_PORT}`,
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm exec vite --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      env: { LIFE_OS_API_URL: API_URL },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
