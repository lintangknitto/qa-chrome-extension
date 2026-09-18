---
name: webapp-testing
description: Executable, local-only E2E + TDD workflow for web apps — real Playwright config, a Python test runner, and a custom self-contained html report (grouped by test-case-matrix category, click a test to expand its steps, every screenshot, and a slowed-down video with adjustable playback speed) — not just markdown code snippets or Playwright's bare default report. Runs up to 3 browser windows in parallel when headed, not an uncapped wall of Chrome windows. No CI provider or GitHub Actions wiring — everything here runs on your own machine, on demand or via an optional local git pre-push hook. Tags and tears down any application data a spec creates (not just report artifacts) so runs don't pollute the app's real database — see `api-testing` for the shared strategy. Use when setting up or running E2E tests for a webapp end-to-end, not just reading patterns about it.
license: MIT
metadata:
  category: testing
  author: lintang
compatible_with: [claude-code, opencode, antigravity, commandcode]
---

# Webapp Testing (E2E + TDD, executable)

Sets up a webapp with a ready-to-run E2E test pipeline — real files you
copy and execute, not markdown snippets to retype every session. Combines
the TDD red-green-refactor discipline with Playwright E2E, wired through a
single Python entrypoint.

**Related skills:** for granular Playwright patterns (Page Object Model,
flaky-test triage, artifact management), see `e2e-testing`. For general
red-green-refactor discipline beyond E2E (unit/integration tests), see
`test-driven-development`. For the scenario list to implement against
(functional/edge/error/state-transition cases) before writing any spec
file, see `test-case-matrix` — run that first, then use each of its
checklist items as the RED step for one spec here. For the database/data
hygiene concerns below (mock vs real DB, cross-service data dependencies,
teardown), see `api-testing`'s references — this skill points to them
rather than duplicating. This skill sits on top of all of these — it's the
scaffolding that turns their patterns into files you actually run.

## When to use

- Setting up E2E testing for a webapp project from scratch
- Adding a new user-facing flow and want a failing E2E test before
  implementing it (TDD applied to E2E)
- Gating a local `git push` on the suite passing, without any CI provider

## When NOT to use

- You just need Playwright *patterns/snippets* to write a test by hand —
  use `e2e-testing` instead
- Pure unit/integration test TDD with no browser involved — use
  `test-driven-development`

## Steps

1. **Install the scaffolding.**
   - Copy `assets/playwright.config.ts` to the project root (merge
     manually if a config already exists).
   - Copy `scripts/run_e2e.py` and `scripts/build_report.py` to the
     project's `scripts/` folder — both assume they live next to each
     other there, and `build_report.py` assumes `scripts/` sits directly
     under the project root (that's what `docs/qa/...` resolves against).
   - Ensure `@playwright/test` is a dev dependency
     (`pnpm add -D @playwright/test`).

   **Always do this in the same pass, don't skip it:** check the project's
   `.gitignore` for `docs/qa/playwright-report/`, `docs/qa/test-results/`,
   `docs/qa/playwright-results.json`, and `docs/qa/*/test-matrix.html` (see
   "All output lives under `docs/qa/`" below) — append whatever's missing.
   This is mandatory setup, not optional cleanup: without it, the very
   first run stages screenshots, videos, and a 1MB+ report file into git.
   `docs/qa/<slug>/test-matrix.md` (from `test-case-matrix`) is the only
   thing under `docs/qa/` that should stay trackable — everything else
   there is regenerated output.

2. **Write the test first (RED).** Before implementing a new flow, write
   an E2E spec under `tests/e2e/` that describes the desired behavior. It
   should fail — see `references/tdd-e2e-workflow.md` for the full
   red-green-refactor cycle applied to E2E specifically. For Page Object
   Model structure, folder layout, and flaky-test handling, follow the
   patterns in `e2e-testing` — this skill owns execution and the report
   format, not the test-writing patterns themselves.

   **Before writing a flow that creates or depends on data, check who owns
   it.** If the flow creates data whose creation logic lives in this repo
   (a normal signup form, say), proceed as usual. If it depends on an
   entity actually created/owned by another repo/service (e.g. this app's
   checkout flow assumes an order that an order-service elsewhere creates),
   stop and ask for that service's repo path, API contract, or a reachable
   staging endpoint instead of guessing its shape or writing straight to
   its tables — see `api-testing`'s
   [`references/cross-service-test-data.md`](../api-testing/references/cross-service-test-data.md)
   for the full reasoning. Either way, tag whatever data the test creates
   (a `run_id`, or a fixed prefix/email domain) so it can be found and
   removed later — see "Test data hygiene" below.

   **Use `assets/step-shot-helper.ts`'s `stepShot` pattern, not a flat test
   body.** Add its `stepShot` function to the project's test fixture file,
   then wrap each logical action in it instead of writing bare
   `await`-chains:

   ```ts
   test('TC-F-01 — login success', async ({ page, loginPage }, testInfo) => {
     await stepShot(page, testInfo, 'Open /login', async () => {
       await loginPage.goto()
     })
     await stepShot(page, testInfo, 'Fill credentials and submit', async () => {
       await loginPage.login(DEMO_EMAIL, DEMO_PASSWORD)
       await expect(page.getByTestId('dashboard-page')).toBeVisible()
     })
   })
   ```

   Map each `stepShot` title to one `Test Steps` row from this test case's
   entry in `test-case-matrix`'s matrix — the report should show the same
   breakdown that's already written down there, not a different one
   invented per-spec. Without this, a test still runs and reports fine, it
   just has an empty step list and only the one auto "on" screenshot in the
   report (see step 3).

   **Match the matrix's language.** If the source matrix writes `Test Case`
   and `Test Steps` in Bahasa Indonesia (see `test-case-matrix`), the
   Playwright `test()` title and every `stepShot` label stay in Bahasa
   Indonesia too — same wording the matrix uses, not translated back to
   English. The report is meant to be read side-by-side with the matrix by
   a manual tester; a language mismatch between them defeats that. Keep the
   `TC-F-01`-style id prefix and `data-testid`/selector literals as-is
   (untranslated) inside an otherwise Indonesian title/label — e.g.
   `test('TC-F-01 — Login berhasil dengan kredensial demo', ...)` with
   `stepShot(page, testInfo, 'Buka /login', ...)`.

3. **Run the suite via the runner, not raw `npx playwright test`.**

   ```bash
   python scripts/run_e2e.py
   ```

   This wraps Playwright using the reporters set in `playwright.config.ts`
   (`list` for live terminal progress, `html`/`json` for the report and
   machine-readable results — see that file, don't pass `--reporter` on the
   CLI, it replaces the config's reporters instead of adding to them),
   prints a pass/fail/flaky summary, then automatically calls
   `build_report.py` to add video speed controls to the report Playwright
   just wrote at `docs/qa/playwright-report/` — one command instead of
   re-deriving Playwright flags each time and remembering to run the
   post-processing step separately, usable the same way whether you type it
   yourself or the pre-push hook (step 5) calls it for you. It also prints
   the report command and where to find a failing test's trace at the end
   of every run, so you don't have to remember them — see "Playwright's own
   report, plus slow-motion video" below. Pass through Playwright options as
   needed: `--grep <pattern>`,
   `--project chromium`. Runs **headed** (a visible browser window) by
   default, so you can watch it work — pass `--headless` for
   unattended/agent-driven runs (an agent isn't watching the window, and
   some sandboxes have no display to open one on at all); the pre-push hook
   also runs headless for the same reason.

   Runs up to 3 workers in parallel even when headed (`workers: 3` in
   config, capped below Playwright's uncapped default of roughly half the
   CPU cores) — enough Chrome windows at once to keep a headed run fast
   without it being an unwatchable wall of browser windows. CI stays
   pinned to 1 worker regardless.

4. **Implement until green.** Re-run `run_e2e.py` after each change until
   the new spec passes, then refactor with tests still green.

5. **Optional: gate `git push` on the suite locally — no CI provider, no
   `.github/workflows/`, nothing that goes near GitHub.** This skill
   deliberately does not ship a GitHub Actions (or any other hosted CI)
   pipeline file — running E2E is meant to stay entirely on the developer's
   own machine. If the user wants pushes gated on tests passing, install
   `assets/pre-push-hook.sh` as a local git hook:

   ```bash
   cp <path-to-this-skill>/assets/pre-push-hook.sh .git/hooks/pre-push
   chmod +x .git/hooks/pre-push
   ```

   This only ever runs locally, as part of the developer's own `git push`
   — no workflow file gets created, nothing is staged, nothing is
   committed. This step is opt-in like the rest of the automation here:
   don't install the hook unless asked, since it changes the behavior of
   every future `git push` on this machine. `rm .git/hooks/pre-push` to
   remove it.

## Playwright's own report, plus slow-motion video

`docs/qa/playwright-report/` is Playwright's **own, unmodified** `html`
reporter output — not a from-scratch clone. That's deliberate: their report
already has a status filter bar (All/Passed/Failed/Flaky/Skipped, each with
a live count), a search box, per-test step lists, `file:line` locations,
browser project badges, and retries shown as tabs — reimplementing all of
that in a custom generator means permanently trailing the real thing.

`build_report.py` (step 3) runs *after* Playwright writes that report and
adds two things on top, without touching Playwright's own markup, styles,
or data:

1. Slow-motion playback controls on every video. It appends a small
   vanilla-JS snippet before `</body>` that finds `<video>` elements — a
   plain HTML5 tag, not part of Playwright's internal React bundle, so this
   stays stable across Playwright version upgrades — sets their default
   rate to 0.5× (a real run is fast enough to be hard to follow at 1×), and
   adds speed buttons (0.25×/0.5×/1×/1.5×) next to each one.
2. A floating **"Test Matrix"** button (bottom-right corner) that opens a
   menu of every `docs/qa/<slug>/test-matrix.md` this project has,
   rendered as a standalone HTML page at `docs/qa/<slug>/test-matrix.html`
   next to the source markdown. This is a small custom renderer for the
   specific subset of markdown `test-case-matrix`'s template uses
   (headers, bold, inline code, links, GFM tables with literal `<br>`
   inside cells) — not a general CommonMark implementation, since the
   input is always that one skill's own generated shape. It re-renders and
   re-injects the menu on every `build_report.py` run (not gated by a
   marker check like the video controls) because which slugs exist can
   change between runs; the video-controls snippet stays gated since it
   never needs updating once present. Lets a tester jump from "did this
   run pass" straight to "which scenario, with what expected result and
   pre-condition, does this test case correspond to" without leaving the
   browser. Skipped silently if no `docs/qa/*/test-matrix.md` exists.

Open the report with `npx playwright show-report docs/qa/playwright-report`
— attachments (screenshots, video, traces) live in a sibling `data/`
folder, so this needs to be served, not opened by double-clicking
`index.html` directly. For a failure that needs deeper debugging (network
log, DOM snapshots at each action), open that test's `trace.zip` from
`docs/qa/test-results/<test>/`:
`npx playwright show-trace <path-to-trace.zip>`.

`playwright.config.ts` sets `screenshot: 'on'` and `video: 'on'` (not
`'only-on-failure'`/`'retain-on-failure'`) so every test, pass or fail,
leaves a screenshot and a video — that's what makes the report skimmable
and watchable at a glance instead of a bare pass/fail list with evidence
only on failure.

## All output lives under `docs/qa/`

`playwright.config.ts` routes every generated artifact into `docs/qa/`,
next to the matrix file `test-case-matrix` writes
(`docs/qa/<slug>/test-matrix.md`) — one place for everything QA-related
instead of loose folders scattered at the project root:

- `docs/qa/playwright-report/` — Playwright's own html report, with video
  speed controls added by `build_report.py`, see "Playwright's own report,
  plus slow-motion video" above.
- `docs/qa/playwright-results.json` — machine-readable results;
  `run_e2e.py`'s `RESULTS_PATH` and `build_report.py`'s `RESULTS_PATH` both
  read this exact path, so if you change the `outputFile` in config,
  update both scripts.
- `docs/qa/test-results/` — raw per-test artifacts (screenshots, videos,
  trace.zip for every test) via `outputDir`.

Add `docs/qa/playwright-report/`, `docs/qa/playwright-results.json`,
`docs/qa/test-results/`, and `docs/qa/*/test-matrix.html` to `.gitignore`
— all of these are regenerated on every run, don't commit them (the
`.html` render of a matrix is derived from the `.md` and can go stale the
moment the `.md` is hand-edited, so it's a build output, not a second
source of truth). `docs/qa/<slug>/test-matrix.md` (from
`test-case-matrix`) is the one thing under `docs/qa/` that **should** be
committed — it's a planning artifact, not a build output.

## Test data hygiene — not just artifact cleanup

Everything in "All output lives under `docs/qa/`" above is about *report
artifacts* (screenshots, videos, JSON results) — regenerated files, cleaned
up via `.gitignore`. That's a different problem from *application data*
these E2E specs create by driving the real UI (a signed-up user, a placed
order) — that data lands in whatever database the app under test is
actually connected to, `.gitignore` does nothing for it, and left alone it
accumulates in that database run after run.

Because a browser-driven E2E test always goes over the network to a real
running app, it is always the "real DB, black-box" case described in
`api-testing`'s
[`references/db-strategy-and-cleanup.md`](../api-testing/references/db-strategy-and-cleanup.md)
— transaction rollback never applies here. Tagging and teardown are
mandatory, not optional, whenever a spec creates data:

1. Tag every record a spec creates during the run (a `run_id` generated
   once per suite invocation, or a fixed prefix like `test+e2e@example.test`
   for emails).
2. Add a Playwright `globalTeardown` (see `playwright.config.ts`'s
   `globalTeardown` option) that deletes everything tagged with this run's
   id, through the app's own API where possible.
3. Also keep a **standalone** cleanup script the user can run manually if
   a run crashed before `globalTeardown` fired — adapt
   `api-testing`'s [`assets/cleanup_test_data.py`](../api-testing/assets/cleanup_test_data.py)
   rather than writing one from scratch. It must be idempotent: running it
   with nothing left to delete is a no-op, not an error.

Don't report an E2E suite "set up" or "passing" while it creates real
records and neither of these exists — that's exactly the kind of silent
data pollution this section exists to prevent.

## Files in this skill

- `scripts/run_e2e.py` — the test runner/orchestrator (stdlib-only Python);
  calls `build_report.py` automatically after every run
- `scripts/build_report.py` — post-processes
  `docs/qa/playwright-report/index.html` (Playwright's own report) to add
  video speed controls and a "Test Matrix" link menu (stdlib-only Python,
  see "Playwright's own report, plus slow-motion video" above); also
  renders every `docs/qa/<slug>/test-matrix.md` to a sibling
  `test-matrix.html`. Can be run standalone to redo all of this without
  rerunning the suite.
- `assets/playwright.config.ts` — ready-to-use Playwright config
- `assets/step-shot-helper.ts` — the `stepShot` pattern from step 2, add to
  the project's test fixtures
- `assets/pre-push-hook.sh` — optional local git pre-push hook, see step 5
- `references/tdd-e2e-workflow.md` — red-green-refactor cycle applied to
  E2E tests specifically, and how it relates to `test-driven-development`
