import { defineConfig, devices } from "@playwright/test";

// Targets a real production build on purpose: the behavior under test
// (static/ISR rendering, the searchParams-driven client filters built on
// top of it - see AUDIT.md A1/Phase 2) doesn't exist under `next dev`.
// Run `npm run build` before `npm run test:e2e`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile 375",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
  ],
});
