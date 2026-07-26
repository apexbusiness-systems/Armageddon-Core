/**
 * Playwright config for armageddon-site e2e specs.
 * Mirrors packages/core/playwright.config.ts settings; testDir points to ./e2e
 * so specs in armageddon-site/e2e/ are discoverable from either workspace root.
 *
 * Run from repo root:
 *   npx playwright test -c armageddon-site/playwright.config.ts
 * Or per contract:
 *   npx playwright test -c packages/core/playwright.config.ts armageddon-site/e2e/
 *   (see note: core config's testDir does not cover armageddon-site/e2e — use this config instead)
 */
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: process.env.CI ? [['github'], ['html', { outputFolder: 'test-results/playwright-report' }]] : [['list'], ['html', { outputFolder: 'test-results/playwright-report', open: 'never' }]],
  use: {
    baseURL,
    bypassCSP: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'npx next dev --hostname 127.0.0.1 --port 3100',
    url: `${baseURL}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
