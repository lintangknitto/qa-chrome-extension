---
name: code-review-and-quality
description: Conducts multi-axis code review. Use before merging any change, when reviewing code written by yourself/another agent/a human, or when you need to assess code quality across multiple dimensions before it enters the main branch. This is the review methodology itself — a reviewer agent should invoke it rather than inventing its own checklist.
license: MIT
compatibility: "Requires reading a diff (git or equivalent) and the repo's own conventions docs if present."
metadata:
  category: review
  source: "addyosmani/agent-skills (MIT)"
  author: lintang
  version: "1.0.0"
allowed-tools: [Read, Grep, Glob, Bash]
disable-model-invocation: false
user-invocable: true
model: inherit
effort: high
compatible_with: [claude-code, opencode, antigravity, commandcode]
---

# Code Review and Quality

## Overview

Multi-dimensional code review with quality gates. Every change gets
reviewed before merge — no exceptions. Review covers five axes:
correctness, readability, architecture, security, and performance.

**The approval standard:** Approve a change when it definitely improves
overall code health, even if it isn't perfect. Perfect code doesn't exist —
the goal is continuous improvement. Don't block a change because it isn't
exactly how you would have written it. If it improves the codebase and
follows the project's conventions, approve it.

## When to use

- Before merging any PR or change
- After completing a feature implementation
- When another agent or model produced code you need to evaluate
- When refactoring existing code
- After any bug fix (review both the fix and the regression test)

## The five-axis review

### 1. Correctness

Does the code do what it claims to do?

- Does it match the spec or task requirements?
- Are edge cases handled (null, empty, boundary values)?
- Are error paths handled (not just the happy path)?
- Does it pass all tests? Are the tests actually testing the right things?
- Are there off-by-one errors, race conditions, or state inconsistencies?

### 2. Readability & simplicity

Can another engineer (or agent) understand this code without the author
explaining it?

- Are names descriptive and consistent with project conventions? (No
  `temp`, `data`, `result` without context)
- Is the control flow straightforward (avoid nested ternaries, deep
  callbacks)?
- Is the code organized logically (related code grouped, clear module
  boundaries)?
- Are there any "clever" tricks that should be simplified?
- **Could this be done in fewer lines?** (1000 lines where 100 suffice is a
  failure)
- **Are abstractions earning their complexity?** (Don't generalize until
  the third use case)
- Would comments help clarify non-obvious intent? (But don't comment
  obvious code.)
- Are there dead code artifacts: no-op variables (`_unused`),
  backwards-compat shims, or `// removed` comments?
- **Is a new conditional bolted onto an unrelated flow?** That's a design
  smell, not a nit — push the logic into its own helper, state, or policy
  instead of tangling an existing path.
- **Do repeated conditionals on the same shape appear?** They signal a
  missing model or dispatcher. A "temporary" branch is usually permanent
  debt.

### 3. Architecture

Does the change fit the system's design?

- Does it follow existing patterns or introduce a new one? If new, is it
  justified?
- Does it maintain clean module boundaries?
- Is there code duplication that should be shared?
- Are dependencies flowing in the right direction (no circular
  dependencies)?
- Is the abstraction level appropriate (not over-engineered, not too
  coupled)?
- **Does this refactor reduce complexity or just relocate it?** Count the
  concepts a reader must hold to follow the change. If a "cleaner" version
  leaves that count unchanged, it isn't cleaner — prefer the restructuring
  that makes whole branches, modes, or layers disappear over one that
  re-centralizes the same logic. Prefer deleting an abstraction to
  polishing it.
- **Is feature-specific logic leaking into a shared or general-purpose
  module?** Keep logic in its owning layer, reuse the existing canonical
  helper instead of a near-duplicate, and don't normalize architectural
  drift.
- **Are type boundaries explicit?** Question gratuitous `any`/`unknown`/
  optional/casts and silent fallbacks that paper over an unclear invariant
  — making the boundary explicit often makes the surrounding control flow
  simpler.

### 4. Security

For detailed guidance, see `references/security-checklist.md`. Does the
change introduce vulnerabilities?

- Is user input validated and sanitized?
- Are secrets kept out of code, logs, and version control?
- Is authentication/authorization checked where needed?
- Are SQL queries parameterized (no string concatenation)?
- Are outputs encoded to prevent XSS?
- Are dependencies from trusted sources with no known vulnerabilities?
- Is data from external sources (APIs, logs, user content, config files)
  treated as untrusted?
- Are external data flows validated at system boundaries before use in
  logic or rendering?

### 5. Performance

For detailed profiling guidance, see `references/performance-checklist.md`.
Does the change introduce performance problems?

- Any N+1 query patterns?
- Any unbounded loops or unconstrained data fetching?
- Any synchronous operations that should be async?
- Any unnecessary re-renders in UI components?
- Any missing pagination on list endpoints?
- Any large objects created in hot paths?

## Structural remedies

When you flag a structural problem, propose the move — not just the
problem. A review that only says "this is complex" leaves the author
guessing. Reach for a named restructuring:

- **Replace a chain of conditionals** with a typed model or an explicit
  dispatcher.
- **Collapse duplicate branches** into a single clearer flow.
- **Separate orchestration from business logic** so each reads on its own.
- **Move feature-specific logic** out of a shared module into the package
  that owns the concept.
- **Reuse the canonical helper** instead of a bespoke near-duplicate.
- **Make a type boundary explicit** so downstream branching disappears.
- **Delete a pass-through wrapper** that adds indirection without
  clarifying the API.
- **Extract a helper, or split a large file** into focused modules.

Prefer the remedy that removes moving pieces over one that spreads the same
complexity around.

## Change sizing

```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if it's a single logical change.
~1000 lines changed  → Too large. Split it.
```

**Watch file size, not just diff size.** A small diff can still push a file
past a healthy boundary — around 1000 *total* lines in a single file is a
common inspection signal, not a hard cap. When a change materially grows an
already-large file, ask whether to extract helpers, subcomponents, or
modules *first*, before piling more on. Decompose, then add.

**What counts as "one change":** A single self-contained modification that
addresses one thing, includes related tests, and keeps the system
functional after submission.

**Separate refactoring from feature work.** A change that refactors
existing code and adds new behavior is two changes — flag it as such. Small
cleanups (variable renaming) can be included at reviewer discretion.

## Review process

### Step 1 — Understand the context

What is this change trying to accomplish? What spec/task does it implement?
What's the expected behavior change?

### Step 2 — Review the tests first

Do tests exist? Do they test behavior, not implementation details? Are edge
cases covered? Would they catch a regression?

### Step 3 — Review the implementation

Walk each changed file through the five axes above.

### Step 4 — Categorize findings

Label every comment with its severity so the author knows what's required
vs. optional:

| Prefix | Meaning | Author action |
|---|---|---|
| *(no prefix)* | Required change | Must address before merge |
| **Critical:** | Blocks merge | Security vulnerability, data loss, broken functionality |
| **Nit:** | Minor, optional | Author may ignore — formatting, style preferences |
| **Optional:** / **Consider:** | Suggestion | Worth considering but not required |
| **FYI** | Informational only | No action needed |

**Lead with what matters.** Order findings by leverage: correctness and
security first, then structural regressions and missed simplifications,
then everything else. Don't bury a real issue under cosmetic nits — a few
high-conviction comments beat a long list.

### Step 5 — Verify the verification

What tests were run? Did the build pass? Was it tested manually? Are there
screenshots for UI changes? Is there a before/after comparison?

**Check reported evidence, don't re-run the full suite yourself.** Answer
these from what's already reported — CI status, results the author/session
already stated, existing screenshots/reports. A quick sanity typecheck or
build is fine if it's cheap. But don't execute the full test suite or a
browser/E2E pass as part of review — that's the expensive verification
pass this pipeline runs separately (`/qa`), deliberately kept out of every
review invocation. If no evidence of verification exists at all, say so as
a finding ("not verified") rather than running the suite yourself to find
out.

## Dead code hygiene

After reviewing a refactor or implementation change, check for orphaned
code. List anything now unreachable or unused explicitly, and **ask before
recommending deletion** — don't silently assume it's safe to remove.

## Honesty in review

- **Don't rubber-stamp.** "LGTM" without evidence of review helps no one.
- **Don't soften real issues.** "This might be a minor concern" when it's a
  bug that will hit production is dishonest.
- **Quantify problems when possible.** "This N+1 query will add ~50ms per
  item in the list" is better than "this could be slow."
- **Push back on approaches with clear problems.** Sycophancy is a failure
  mode in reviews.
- **Comment on code, not people.**

## Dependency discipline

Part of code review is dependency review:

**Before adding any dependency:** does the existing stack already solve
this? How large is it? Is it actively maintained? Any known
vulnerabilities? Is the license compatible?

**Rule:** prefer standard library and existing utilities over new
dependencies. Every dependency is a liability.

**Upgrading a dependency** is a code change like any other — read the
changelog (not just the version number), upgrade one dependency per change,
let the tests decide, mind the transitive graph (review the lockfile diff,
not just the manifest), and never hand-edit the lockfile.

## The review checklist

```markdown
## Review: [PR/Change title]

### Context
- [ ] I understand what this change does and why

### Correctness
- [ ] Change matches spec/task requirements
- [ ] Edge cases handled
- [ ] Error paths handled
- [ ] Tests cover the change adequately

### Readability
- [ ] Names are clear and consistent
- [ ] Logic is straightforward
- [ ] No unnecessary complexity

### Architecture
- [ ] Follows existing patterns
- [ ] No unnecessary coupling or dependencies
- [ ] Appropriate abstraction level
- [ ] Refactors reduce complexity rather than relocate it
- [ ] No feature logic in shared modules; file stays within a healthy size

### Security
- [ ] No secrets in code
- [ ] Input validated at boundaries
- [ ] No injection vulnerabilities
- [ ] Auth checks in place
- [ ] External data sources treated as untrusted

### Performance
- [ ] No N+1 patterns
- [ ] No unbounded operations
- [ ] Pagination on list endpoints

### Verification
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Manual verification done (if applicable)

### Verdict
- [ ] **Approve** — Ready to merge
- [ ] **Approve with comments** — Non-blocking issues noted
- [ ] **Changes requested** — Issues must be addressed
```

## Common rationalizations

| Rationalization | Reality |
|---|---|
| "It works, that's good enough" | Working code that's unreadable, insecure, or architecturally wrong creates debt that compounds. |
| "I wrote it, so I know it's correct" | Authors are blind to their own assumptions. Every change benefits from another set of eyes. |
| "We'll clean it up later" | Later never comes. The review is the quality gate — use it. |
| "AI-generated code is probably fine" | AI code needs more scrutiny, not less. It's confident and plausible, even when wrong. |
| "The tests pass, so it's good" | Tests are necessary but not sufficient. They don't catch architecture, security, or readability problems. |
| "The refactor makes it cleaner" | Relocating complexity isn't reducing it. If the reader still holds the same number of concepts, the structure didn't improve. |
| "It's only a small addition to this file" | Small diffs still push files past a healthy size and bolt branches onto unrelated flows. |
| "It's just a version bump" | A bump is a behavior change you didn't write. Read the changelog. |
| "I'll upgrade everything in one PR to save time" | A bulk bump that breaks the build hides which package did it. |

## Red flags

- PRs merged without any review
- Review that only checks if tests pass (ignoring other axes)
- "LGTM" without evidence of actual review
- Security-sensitive changes without security-focused review
- Large PRs that are "too big to review properly" (recommend splitting)
- No regression tests with bug fix PRs
- Review comments without severity labels
- Accepting "I'll fix it later" as a substitute for fixing it now
- A refactor that moves code around without reducing the number of
  concepts a reader must hold
- A change that grows an already-large file instead of decomposing it
- New conditionals scattered into unrelated code paths (a missing
  abstraction)
- A bespoke helper that duplicates an existing canonical one
- A bulk "bump dependencies" PR with no changelog review
- A hand-edited or uncommitted lockfile change

## Verification (before handing back a verdict)

- [ ] All Critical issues are resolved or explicitly called out as blocking
- [ ] All Required (no-prefix) changes are resolved or explicitly deferred
      with justification
- [ ] Tests pass, build succeeds
- [ ] The verification story is documented (what changed, how it was
      verified)
- [ ] Dependency upgrades were reviewed against their changelog, isolated
      per package, with the lockfile diff reviewed

## See also

- `references/security-checklist.md` — deeper OWASP-style checklist for
  the security axis
- `references/performance-checklist.md` — profiling and optimization
  checklist for the performance axis
