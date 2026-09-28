import { defineConfig, devices } from "@playwright/test";

// Targets a real production build on purpose: the behavior under test
// (static/ISR rendering, the searchParams-driven client filters built on
// top of it - see AUDIT.md A1/Phase 2) doesn't exist under `next dev`.
// Always run through `npm run test:e2e`, not `playwright test` directly -
// that script sets NODE_ENV=test for both the build and the run.
//
// NODE_ENV=test matters for more than just this config file: Next.js has
// a first-class "test" environment (see
// node_modules/next/dist/docs/.../environment-variables.md) that loads
// .env.test and *skips .env.local entirely* - confirmed empirically, not
// assumed (a canary value in .env.test with no Supabase vars made the
// build fail with "supabaseUrl is required" instead of silently falling
// back to .env.local's real project). This is the actual safety
// mechanism that stops e2e tests from touching production data - see
// AUDIT.md Phase 5 for what backend .env.test points at.
//
// webServer.command below sets NODE_ENV=test explicitly (not just
// relying on inheriting it from the npm script that launched Playwright)
// so this still does the right thing if `playwright test` is ever
// invoked directly. NEXT_PUBLIC_* vars are inlined at *build* time, so
// the build step (in package.json's test:e2e script) needs the same
// NODE_ENV=test just as much as this start step does.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Capped from Playwright's full-parallelism default: running against
  // the real (Free-tier) Supabase project caused one real, reproducible
  // flaky failure from concurrent DB load (see AUDIT.md H4) - the same
  // query passed cleanly in isolation. Left capped even after moving to
  // a dedicated test backend (AUDIT.md Phase 5), since a local Postgres
  // in Docker or a separate free-tier project can both still see the
  // same kind of contention under full parallelism; revisit if the test
  // backend turns out not to need it.
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "cross-env NODE_ENV=test next start",
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
