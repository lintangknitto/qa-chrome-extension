# TDD applied to E2E

The general red-green-refactor discipline is covered in
`test-driven-development` — this is that cycle applied specifically to
browser-level E2E tests, where "red" means a real browser failing to find
an element or hit an expected state, not just an assertion throwing.

## Cycle

1. **RED** — Before implementing a new user-facing flow, write the E2E
   spec under `tests/e2e/` that describes the finished behavior (e.g. "user
   can search and see results"). Run it with `run_e2e.py`. It must fail —
   confirm the failure reason is "feature doesn't exist yet", not a typo in
   the test itself.
2. **GREEN** — Implement the minimum UI/backend change needed to make the
   spec pass. Re-run `run_e2e.py --grep "<spec name>"` to iterate fast
   without running the full suite.
3. **REFACTOR** — With the spec green, clean up the implementation. Run the
   full suite (`run_e2e.py`, no `--grep`) before considering the change
   done.

## Bug fixes (Prove-It Pattern for E2E)

When a UI bug is reported:

1. Write an E2E spec that reproduces it — it should fail.
2. Fix the bug.
3. Re-run the spec — it should pass.
4. Run the full suite to check for regressions.

## Scope guidance

Not every behavior needs an E2E test. Follow the test pyramid from
`test-driven-development`: E2E specs are for critical, cross-cutting user
flows (login, checkout, core CRUD paths) — push logic-level assertions
down to unit/integration tests, which run faster and are cheaper to
maintain. If a change is purely internal (no user-visible flow changes),
E2E is the wrong tool; use `test-driven-development`'s unit/integration
guidance instead.

## Granular patterns

For Page Object Model structure, flaky-test triage, artifact/trace
management, and other Playwright-specific patterns, see `e2e-testing`.
This file only covers the TDD loop — not how to structure Playwright code.
