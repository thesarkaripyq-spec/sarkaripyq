import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for SarkariPYQ end-to-end tests.
 *
 * Usage:
 *   npm start                # in one terminal — boots CRA on http://localhost:3000
 *   npm run e2e              # in another terminal — runs the suite headless
 *   npm run e2e:headed       # run with a visible browser for debugging
 *   npm run e2e:ui           # launch the Playwright UI mode
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',

  // Shared settings applied to every test via the `use` block.
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  // Spin the dev server up automatically when not in CI so a single
  // `npm run e2e` is enough for a fresh checkout.
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm start',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
