// Add this to your project's Playwright test fixture file (e.g.
// tests/e2e/fixtures/test.ts), alongside your existing `test.extend(...)`.
//
// Purpose: build_report.py's custom report (docs/qa/report.html) shows a
// step list and a screenshot gallery per test case when you click it — but
// only if the spec actually records that data. A flat test body with no
// `test.step()` calls just gets the single final-state screenshot from
// `screenshot: 'on'` in playwright.config.ts and an empty step list. Wrap
// each logical step in `stepShot` instead to get both.
//
// Usage in a spec:
//
//   test('TC-F-01 — login success', async ({ page, loginPage }, testInfo) => {
//     await stepShot(page, testInfo, 'Open /login', async () => {
//       await loginPage.goto()
//     })
//     await stepShot(page, testInfo, 'Fill credentials and submit', async () => {
//       await loginPage.login(DEMO_EMAIL, DEMO_PASSWORD)
//       await expect(page.getByTestId('dashboard-page')).toBeVisible()
//     })
//   })
//
// Map each `stepShot` call's title to one "Steps → Expected" row from the
// test-case-matrix skill's matrix for this test case — steps in the report
// should read the same as the steps already written down in
// docs/qa/<slug>/test-matrix.md, not a different breakdown invented here.

import type { Page, TestInfo } from '@playwright/test'
import { test } from '@playwright/test'

export async function stepShot(
  page: Page,
  testInfo: TestInfo,
  title: string,
  action: () => Promise<void>,
) {
  await test.step(title, async () => {
    await action()
    const body = await page.screenshot()
    await testInfo.attach(title, { body, contentType: 'image/png' })
  })
}
