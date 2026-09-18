---
name: branching
description: Use when the user wants to create a feature branch, sync work to a staging/sandbox release branch, or prepare a production merge in a repo that uses a paired feature-branch (main/dev) + long-lived releases/* deploy-branch git model. Triggers on "buat branch buat PB ini", "sync ke sandbox", "cherry-pick ke staging", "mau deploy ke sandbox/staging", "branch buat fitur ini", or when releases/sandbox and releases/main branches with CI auto-deploy are detected in the repo. Not for repos using plain GitHub Flow (single main + short-lived feature branches merged via PR) or trunk-based development — detect the convention first (Step 0) rather than assuming this model applies.
license: MIT
compatibility: "Requires git and, for the sync step, awareness of what has already been cherry-picked into the shared staging branch — check before picking, don't guess."
metadata:
  category: git-workflow
  author: lintang
  version: "1.0.0"
allowed-tools: [Bash, Read, Grep, Glob]
argument-hint: "new <slug> | sync <slug> | promote <slug>"
when_to_use: "Also trigger proactively when the user says a feature is ready to test on staging/sandbox, or ready for production, in a repo already using this branch model."
disable-model-invocation: false
user-invocable: true
model: inherit
effort: medium
compatible_with: [claude-code, opencode, antigravity, commandcode]
---

# branching

Manage feature branches in a **paired branch + long-lived release-branch**
git model: work happens on a `-main`-suffixed branch, gets cherry-picked
onto a `-dev`-suffixed companion branch to reach a shared `releases/sandbox`
staging branch, and finally gets promoted to `main`/`releases/main` for
production. See `references/knitto-api-example.md` for a concrete worked
example this skill is modeled on.

This is **not** generic git-flow — don't apply GitHub Flow or trunk-based
instincts here. The defining trait is that promotion to staging happens via
**cherry-pick onto a separate branch**, not a direct merge of the working
branch, specifically so the shared staging branch doesn't inherit
in-progress/messy commit history from every feature.

## Step 0 — Detect whether this model applies

Before doing anything, verify this repo actually uses this model — don't
assume:

```
git branch -a | grep -E 'releases/(sandbox|staging|main)'
git branch -a | grep -E '\-(main|dev)$'
```

Also check CI config (`.github/workflows/*.yml` or equivalent) for deploy
jobs triggered on push to `releases/*` branches — that confirms these are
long-lived deploy branches, not throwaway ones. If none of this is present,
this skill doesn't apply — fall back to whatever branching convention the
repo's CONTRIBUTING/README actually documents, or plain feature-branch +
PR-to-main.

If it does apply, read the repo's own docs (often in `README.md`) for the
**exact** branch naming and commit-message convention — the names below
(`-main`/`-dev`, `releases/sandbox`, `releases/main`) are the pattern to
recognize, not to hardcode; a given repo may use `staging` instead of
`sandbox`, or a different suffix scheme.

**Naming isn't fixed — check which one this repo actually has.** The
`git branch -a | grep -E 'releases/(sandbox|staging|main)'` above matches
both `releases/sandbox` and `releases/staging`. Don't default to one:
- If only one of `releases/sandbox` / `releases/staging` exists, use that
  one.
- If **both** exist, don't guess which is the real staging target — ask
  the user to clarify (they may be two different environments, or one may
  be stale/deprecated) before opening any sync/promote PR against either.

## `new <slug>` — start a new feature branch

1. Confirm the base: create the working branch from the trunk (`main`, or
   whatever this repo's default branch is) — never from `releases/sandbox`
   or another feature branch, even if that's what's currently checked out.
2. Name it per this repo's convention (e.g. `feat/<slug>-main`,
   `fix/<slug>-main`, `hotfix/<slug>-main` — prefix matches the change
   type, same as a conventional-commits-style prefix would).
3. Check the repo's commit-message convention from recent history
   (`git log --oneline -20` on a similar existing branch) before assuming
   one — some repos require a feature-name prefix on every commit (e.g.
   `` `nama fitur`: pesan commit `` ) specifically because commits get
   cherry-picked later and need to stay identifiable out of context.

## `sync <slug>` — get the feature onto staging

This is the step most likely to go wrong, and the reason this skill exists:
the staging branch (`releases/sandbox`/`releases/staging`) is a **shared
integration branch** that many features cherry-pick into concurrently. Two
failure modes to actively guard against:

- **Duplicate cherry-picks** — re-picking a commit that's already on
  staging (from an earlier sync) creates a duplicate/conflicting commit.
- **Missed commits** — new commits added to the `-main` branch since the
  last sync don't make it to `-dev`/staging, so staging silently falls
  behind what's actually been built (this is the "staging ketinggalan
  banyak fitur" problem — it compounds when this check is skipped
  repeatedly across many features).

Procedure:

1. Identify what's new: compare the `-main` branch against its `-dev`
   companion to find commits not yet cherry-picked:
   ```
   git log <slug>-dev..<slug>-main --oneline
   ```
   Only these are candidates to cherry-pick — never re-pick anything
   already reachable from `-dev`.
2. If `-dev` doesn't exist yet, create it from the current `-main` head
   (first sync for this feature) rather than from `releases/sandbox` — the
   dev branch's job is to mirror `-main`'s content, not to start from
   staging's current state.
3. Checkout `-dev`, cherry-pick the identified commits **in order**, using
   `git cherry-pick -x` so each picked commit records its origin SHA —
   this is what makes step 1's diffing reliable on the *next* sync, and
   lets anyone trace a staging commit back to its source.
4. Resolve conflicts commit-by-commit as they arise; don't resolve by
   force-taking one side wholesale — a cherry-pick conflict usually means
   another feature already touched the same code on staging, and the
   correct resolution requires understanding both changes, not picking a
   winner blindly.
5. Before merging/pushing `-dev` into the shared staging branch, check
   what's already there that might overlap:
   ```
   git log releases/sandbox --oneline -20
   git log releases/sandbox..<slug>-dev --oneline
   ```
   The second command shows exactly what this sync is about to add — sanity
   check it's what you expect, not more or less.
6. Merge or open a PR into the staging branch per this repo's convention
   (some repos merge directly, others require PR + review even for
   staging — check for branch protection or an explicit review-request
   step in the repo's docs before assuming).
7. **Never force-push a shared release/staging branch.** If history there
   needs correcting, that's a decision for whoever owns the release
   process, not something to do unilaterally mid-sync.

## `promote <slug>` — open the production PR

This step is git-PR mechanics only — it never checks CI, never checks
whether a merge triggers a deploy, and never touches a `releases/main`-style
branch. Confirm `/qa`/`/gate` (or this repo's equivalent verification +
review sign-off) already passed before opening the PR — don't promote on
the assumption that "it works on staging" alone is sufficient if the
repo's process requires explicit sign-off.

1. Open a PR from `<slug>-main` (the working branch — not `-dev`, which is
   a staging-only artifact) into the trunk (`main`).
2. That's the whole step. Whatever happens after the PR merges (deploy
   triggers, a separate `releases/main` push, CI gates) is outside this
   skill's scope — don't chase it.
3. Once the PR is merged, offer to clean up the merged `-main` and `-dev`
   branches — ask first, don't delete unilaterally, since `-dev` may still
   be referenced by the staging branch's history via the `-x` cherry-pick
   trailers.

In this repo's pipeline, `sync <slug>` and `promote <slug>` are both run
from inside `/promote` (see `commands/promote/`) rather than invoked as
separate user-facing steps — `/promote` opens the trunk PR and runs the
sync-to-staging PR together, in one pass, once `/gate` has approved.

## What this skill is not

- Not a generic git-flow/GitHub-flow guide — it's specific to the
  paired-branch + cherry-pick-to-staging model. Verify Step 0 before
  applying any of this.
- Not a substitute for checking this repo's own documented convention —
  the exact branch names, commit-message rules, and review requirements
  vary per repo; this skill teaches the *shape* of the workflow and the
  failure modes to avoid, not a fixed script.
- Not a way to bypass required reviews/testing sign-off to move faster —
  the sync/promote gates exist on purpose.
