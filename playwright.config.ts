import { defineConfig, devices } from "@playwright/test";

// Targets a real production build on purpose: the behavior under test
// (static/ISR rendering, the searchParams-driven client filters built on
// top of it - see AUDIT.md A1/Phase 2) doesn't exist under `next dev`.
// Run `npm run build` before `npm run test:e2e`.
//
// This currently runs against the real Supabase project (no local
// Postgres/Docker available in this environment for a true isolated test
// DB - see Phase 5 notes in AUDIT.md). Capped workers below: full
// parallelism (the default) caused one real, reproducible flaky failure
// from concurrent DB load on the Free tier (see AUDIT.md H4) - the same
// query passed cleanly in isolation. This is a mitigation for a shared
// real backend, not a fix for the underlying resource constraint.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 4,
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
