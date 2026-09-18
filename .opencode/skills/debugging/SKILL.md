---
name: debugging
description: Systematic root-cause debugging methodology for when something that used to work (or should work) is broken — reproduce reliably, isolate the smallest failing case, bisect to the change that introduced it, and fix the root cause instead of the symptom. Use when investigating a bug, an unexpected error, a regression, or "this used to work and now it doesn't" — not for general code review or writing new tests from scratch (see code-review-and-quality, test-driven-development for those).
license: MIT
metadata:
  category: debugging
  author: lintang
compatible_with: [claude-code, opencode, antigravity, commandcode]
---

# Debugging

A disciplined loop for finding *why* something is broken, not just making
the symptom disappear: reproduce it reliably, isolate the smallest case
that still fails, find the exact change or condition that caused it, then
fix the actual cause. Every other skill in this catalog is about writing
correct code up front (review, tests, patterns) — this one is about what
to do once something is already wrong.

## When to use

- There's an error, crash, or wrong behavior that needs investigating
  before it can be fixed.
- A regression — something that used to work, now doesn't.
- A bug that only happens "sometimes" (flaky/intermittent) and needs to be
  isolated before it can be fixed with confidence.
- The user says "why is this erroring", "why does this happen", "find out
  why X is broken".

## When NOT to use

- Writing a brand-new feature from scratch (there's no bug to investigate)
  — that's `incremental-implementation`/`test-driven-development`.
- Reviewing code that isn't known to have a bug, just checking its quality
  — that's `code-review-and-quality`.
- The cause is already known and it's just a matter of applying the fix —
  go ahead and fix it, no need to run the full investigation loop below.

## Steps

1. **Reproduce it first, before touching any code.** Don't start changing
   anything until the bug can be triggered consistently (a command, an
   input, UI steps, or a failing test). If it can't be reproduced at all
   after reasonable effort, that's itself a finding worth reporting — tell
   the user what was tried, don't guess a fix for something that hasn't
   been confirmed to happen.
   - Intermittent bugs: look for a pattern first (only under certain
     conditions? race condition? timing? a specific environment?) before
     treating it as random.

2. **Read the error/stack trace all the way through before assuming
   anything.** The first line of a traceback is often not the root cause —
   follow it down to the frame that belongs to the project's own code
   (not the library/framework), and read the error message literally
   before guessing at its cause.

3. **Isolate to the smallest case that still fails.** Strip out irrelevant
   variables one at a time (smaller test data, disable other features,
   call the function directly instead of going through the whole UI flow)
   until the reproduction is as minimal as possible. A small case is far
   faster to debug than the full flow.

4. **Bisect to the change that caused it (if this is a regression).** If
   there's git history, find the commit that introduced the bug — `git
   log` on the relevant file, or `git bisect` when the range isn't
   obvious — don't guess which commit broke it.

5. **Form a hypothesis, then test it — don't paste a fix and hope.** Every
   suspected cause should be verified (temporary logging/print statements,
   a breakpoint, or an assertion) before writing a fix. A fix written
   without first verifying the cause often just papers over the symptom in
   one spot while the root cause remains.

6. **Tell symptom apart from root cause before fixing.** If the fix is a
   null-check/try-catch/workaround right where the crash happens, ask
   first: why is the value null/invalid there in the first place? If
   there's a deeper cause that can and should be prevented at the source,
   fix it there — not just muffle the symptom at the point of failure.

7. **Verify the fix actually closes the case from steps 1 and 3**, then run
   the relevant test suite (not just the case that was just fixed) to make
   sure nothing new regressed. If there's a relevant test framework and no
   test exists for this bug yet, write one — so the same bug can't slip
   through again (see `test-driven-development` for the red-green-refactor
   pattern for that).

8. **Report the finding, not just "it's fixed now".** Summarize for the
   user: what the root cause was, why it happened, and what changed —
   especially if the fix touches a wider area than the original crash
   site.

## When reproduction fails after reasonable attempts

Don't keep guessing fixes at random. Report to the user: what's been
tried, what signals exist (logs, error messages, conditions that seem to
trigger it), and what additional information is needed (production log
access, more detailed reproduction steps, a specific environment) —
a stuck investigation is a valid finding, not a failure to be papered over
with a speculative fix.
