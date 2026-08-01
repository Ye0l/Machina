import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests for the built client.
 *
 * They run against `dist/`, served by the stub in `tests/e2e/stub-server.ts` -- so
 * `pnpm run build` must have run first (the `test:e2e` script does it).
 *
 * `PLAYWRIGHT_CHROMIUM_PATH` overrides the browser binary. CI installs its own matching
 * build and leaves it unset; sandboxes with a pre-installed Chromium of a different version
 * set it rather than downloading a second copy.
 *
 * Paths are relative to this file, which is how Playwright resolves them. `import.meta` is
 * unavailable: the repository is CommonJS, so Playwright transpiles this config to CJS.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '../.playwright',
  // A failure here is a real regression, so let CI retry once to absorb flake rather than
  // masking it locally.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    ...devices['Desktop Chrome'],
    launchOptions: { executablePath },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 900 } },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 } },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
})
