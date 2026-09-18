import { defineConfig, devices } from '@playwright/test'

// All Playwright output lives under docs/qa/ — next to test-matrix.md from
// the test-case-matrix skill — so everything QA-related for this app is in
// one place instead of scattered loose folders at the project root.
const QA_DIR = 'docs/qa'

// Headless in CI, or when HEADLESS=true is set explicitly for an
// unattended/agent-driven local run. Headed otherwise (a human at a
// terminal, watching).
const isHeadless = !!process.env.CI || process.env.HEADLESS === 'true'

export default defineConfig({
  testDir: './tests/e2e',
  // Raw per-test artifacts (failure screenshots/videos/traces before the
  // html report bundles them) — also under docs/qa/, not the default
  // root-level test-results/.
  outputDir: `${QA_DIR}/test-results`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Capped at 3 locally — some parallelism keeps a headed run fast, but
  // Playwright's uncapped default (roughly half the CPU cores) can open
  // far more Chrome windows at once than is useful to watch.
  workers: process.env.CI ? 1 : 3,
  reporter: [
    // 'list' gives live pass/fail progress in the terminal while the suite
    // runs — without it, specifying html/json here replaces Playwright's
    // default reporter entirely and the terminal stays silent until the
    // whole run finishes.
    ['list'],
    // Playwright's own report, unmodified — filters (All/Passed/Failed/
    // Flaky/Skipped), search, per-test steps, location links, browser
    // badges, retries as tabs. build_report.py (called by run_e2e.py after
    // every run) only post-processes this file afterwards to add
    // slowed-down video playback controls — see that script, not a
    // from-scratch clone of this report.
    ['html', { outputFolder: `${QA_DIR}/playwright-report`, open: 'never' }],
    ['json', { outputFile: `${QA_DIR}/playwright-results.json` }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    headless: isHeadless,
    trace: 'on-first-retry',
    // 'on' (not 'only-on-failure') so every test — pass or fail — leaves a
    // final screenshot attached in the report; that's what makes it
    // visually useful to skim instead of just a pass/fail list. Same for
    // video: every test gets one, embedded in report.html at a slowed-down
    // playback rate (see build_report.py) since a real run is too fast to
    // follow otherwise.
    screenshot: 'on',
    video: 'on',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
