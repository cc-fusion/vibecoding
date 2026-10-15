import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'reports/browser-results.json' }]],
  use: { browserName: 'chromium', headless: true, viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === '1' },
  webServer: { command: 'node server.mjs', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 30_000 }
});
