import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Cognivern.
 *
 * The Playwright web server binds the frontend to a fixed port (default 3000,
 * overridable via PLAYWRIGHT_PORT when another dev server already occupies
 * it) so a developer's ambient PORT value cannot make the runner wait on the
 * wrong port — or silently reuse an unrelated project that happens to listen
 * on 3000 (reuseExistingServer only checks "something responded").
 */
const port = Number(process.env.PLAYWRIGHT_PORT || 3000);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60_000,

  use: {
    baseURL: `http://localhost:${port}`,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `PORT=${port} pnpm frontend`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
