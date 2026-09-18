---
name: dependency-update
description: Safe process for upgrading project dependencies — check for breaking changes via changelogs, upgrade incrementally rather than all-at-once, verify the build/test suite after each batch, and handle lockfile conflicts. Use when the user asks to update/upgrade/bump dependencies, fix a dependency vulnerability, or when a dependency is badly out of date. Not for adding a brand-new dependency to the project (that's a design decision, not an upgrade) or for database schema migrations (see database-migrations).
license: MIT
metadata:
  category: maintenance
  author: lintang
compatible_with: [claude-code, opencode, antigravity, commandcode]
---

# Dependency Update

Process for bumping existing dependencies without breaking the project —
the risk isn't running the upgrade command, it's not knowing what changed
underneath until something fails in a way that's hard to trace back to the
bump. This skill is about *how* to upgrade safely, not about deciding
*whether* to adopt a new dependency in the first place.

## When to use

- The user asks to update/upgrade/bump a dependency, or fix a
  vulnerability reported by `pnpm audit`/`pip-audit`/etc.
- A dependency is badly out of date and starting to block other features
  or fixes.
- A new major version of a core framework/library has been released and
  needs evaluating.

## When NOT to use

- Adding a brand-new dependency the project has never used before — that's
  a design decision (choosing a library, evaluating maintenance/license),
  different from just bumping the version of something already in use.
- Database schema migrations — that's `database-migrations`, even though
  the two sometimes run together (e.g. a major ORM upgrade that changes
  how migrations are written).

## Steps

1. **Check what actually changed before running the upgrade command.** For
   every dependency bumping a major version (and minor for core/critical
   libraries), read its changelog/release notes — look for "breaking",
   "deprecated", "removed". Don't assume a semver minor is always safe;
   verify it, especially for a dependency with a history of breaking
   semver.

2. **Upgrade incrementally, not all dependencies at once.** Batch by risk:
   - Patch/minor version bumps for non-critical dependencies: can be
     batched together, low risk.
   - Major version bumps, or core dependencies (framework, ORM, test
     runner): one at a time, so if something breaks, the cause is clear —
     upgrading everything at once and then having something break means
     debugging across many simultaneous changes.

3. **Verify build + test suite after each batch**, not just at the end of
   all upgrades. If the relevant changelog mentions a breaking change,
   check its usage in the code explicitly (grep for the
   deprecated/removed API) — don't just rely on tests passing, since
   existing coverage may not touch the changed area.

4. **The lockfile is updated alongside the manifest, never left diverged
   from `package.json`/`requirements.txt`/etc.** If there's a lockfile
   conflict (common after a merge), regenerate it from the manifest, don't
   resolve it manually by guessing versions.

5. **Prioritize vulnerability fixes by severity and actual exploitability
   in this project** — not by blindly upgrading everything an audit report
   flags. Check whether the project's code actually calls the vulnerable
   path before rushing to bump (sometimes a vulnerability is in a
   transitive dependency that's never invoked from the project's code).

6. **For a major upgrade of a core framework/library, check its official
   migration guide** (most large projects publish one) and follow its
   order — don't improvise the sequence of changes when a tested official
   guide already exists.

7. **Report a summary to the user**: which dependencies were bumped, from
   which version to which, what breaking changes were found and how they
   were accommodated in the code, and the result of test/build
   verification.

## Signs to stop and report instead of continuing to guess

If, after an upgrade, a test fails in a way that isn't clearly connected
to anything in the changelog that was read, or a dependency has an
unclear release history (empty/unstructured changelog), stop and ask the
user whether that upgrade still needs to happen right now — don't pin to
a random version hoping the problem goes away on its own.
