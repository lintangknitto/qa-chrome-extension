---
name: skill-sync
description: Check installed skills/agents/commands (project and/or global) against their source (this agent-skills catalog, at a URL or local clone) and update the ones that changed upstream — without clobbering a project's own project-scoped overrides. Asks which scope (project/global/both) when lockfiles exist at both levels, and shows an interactive checklist of tracked skills/agents to pick which ones to sync rather than syncing everything unasked. Use when the user asks to "update my skills", "cek update skill", "sync ke versi terbaru", or after a known upstream change to a skill they already installed. Requires a lockfile written at install time (see INSTALL.md Langkah 6); without one, falls back to an explicit ad-hoc whole-file compare that always asks before overwriting. Not for the initial install of a skill (see INSTALL.md) and not for authoring a new skill.
license: MIT
metadata:
  category: foundation
  author: lintang
compatible_with: [claude-code, opencode, antigravity, commandcode]
---

# Skill Sync

Keeps skills/agents/commands installed in a project in sync with this
catalog's source, without silently overwriting a repo's own customizations.
This is the *update* half of the lifecycle — `INSTALL.md` is the initial
copy, `agent-doctor` verifies an installed agent actually runs on its
platform, this skill checks whether an already-installed file is stale
relative to where it came from.

## Why this needs a lockfile, not a blind re-copy

A naive "re-copy every file from the catalog" would silently destroy any
project-scoped override (see `CONTRIBUTING.md` and
`skills/prd-grill/references/project-override-example.md`) — a repo that
deliberately adapted a skill to its own conventions would lose that work
the next time someone ran an update. Telling "the user changed this on
purpose" apart from "this just hasn't been updated since install" requires
knowing what the file looked like **at install time** — which means a
lockfile, not just comparing current-project-file vs current-catalog-file.

## Step 0 — Locate the lockfile(s) and confirm scope

Installs can be **project**-level or **global** (per INSTALL.md Langkah
4/6) — check both locations, don't assume one:

- Project: `.agent-skills-lock.json` at the current project root.
- Global: `~/.agent-skills-lock.json` (one shared file regardless of which
  platform(s) were chosen at install time — see INSTALL.md Langkah 6).

- **Only one exists:** use it, no need to ask which scope.
- **Both exist:** ask the user which scope they mean to sync — project,
  global, or both — before going further. Don't silently pick one; a
  skill can be tracked at both levels with different baselines, and
  syncing the wrong one either misses what the user actually meant or
  touches installs they didn't ask about.
- **Neither exists:** this project/machine predates lock tracking, or was
  installed before this skill existed. Don't guess a baseline — tell the
  user no tracked installs were found, and offer two options: (a) rebuild
  a lockfile now (ask which scope it should be — project or global — then
  ask which currently-installed skills/agents came from this catalog and
  treat their current content as the new baseline so future syncs work),
  or (b) run a one-off **ad-hoc mode**: compare each named file's current
  content directly against the catalog's current content and present the
  diff — every match gets asked before overwrite, since there's no way to
  tell an intentional override from a stale copy without a baseline.

Once the lockfile(s) to use are settled, read it/them. Each entry should
have: the skill/agent name, the platform file paths installed from it,
the `source_url` it was installed from, the `source_commit` (catalog repo
commit SHA at install time), and a content hash per installed file as it
stood right after copying.

**When both lockfiles exist, cross-check for untracked files in the other
scope before moving to Step 1.** This catches the case where a multi-scope
install (e.g. commands installed to both a project and globally to
`~/.claude/commands/` in the same session) only wrote its lockfile entry
to one scope, leaving the other scope's copy of the same file physically
present but invisible to sync — it never gets checked for staleness. For
each entry present in lockfile A, check whether a file at the equivalent
path also exists physically in scope B (e.g. `~/.claude/commands/<name>.md`
for a `command`-type entry) without a matching entry in lockfile B's
entries. If found, flag it to the user as "untracked in scope B — mau
di-backfill entry-nya ke `<lockfile B path>` (sumber sama, hash dihitung
dari file yang ada sekarang)?" rather than silently ignoring it. Backfilling
means adding an entry to lockfile B with the same `source_url`/
`source_commit` as lockfile A's entry and a freshly computed hash of scope
B's current file content — do this only after the user confirms, and note
it in the final Step 5 report.

## Step 1 — Ask which tracked skills/agents to sync

Unless a specific skill/agent name was already given as an argument, list
every entry from the lockfile(s) resolved in Step 0 as an **interactive
multi-select checklist** (same mechanic as INSTALL.md Step 3 — pick a
choice-style tool if available, split into multiple questions if the
tracked list exceeds the tool's per-question option limit) and let the
user pick which ones to actually sync — don't process every tracked entry
unasked just because it's in the lockfile. Group by scope if both
project and global were selected in Step 0, so the user can tell which
install each choice affects.

If a specific skill/agent name was given as an argument, skip this
checklist and sync just that one (still validating it's actually a
tracked lockfile entry — if not, say so rather than silently no-op'ing).

## Step 2 — Resolve the source

Ask for (or reuse a previously-given) source URL for this catalog if not
already recorded in the lockfile's `source_url`.

- **GitHub source (preferred path, no clone needed):** if `source_url`
  points at a GitHub repo, use the GitHub API instead of cloning —
  `GET /repos/{owner}/{repo}/commits?path=...&sha={branch}` (or the
  `git/trees` + `contents` endpoints) to read each tracked file's current
  blob SHA and latest commit SHA directly. Compare those against the
  lockfile's baseline `source_commit`/hash without pulling the whole repo.
  Only fetch the raw content (`raw.githubusercontent.com` or the
  `contents` API's base64 payload) for files whose blob SHA actually
  differs from baseline — this is the normal case and keeps updates cheap
  even for large catalogs, since most syncs touch a handful of files.
- **Non-GitHub source, or GitHub API unreachable/rate-limited:** fall back
  to a local clone. If a local clone of that URL already exists (check the
  lockfile for a cached local path first, then common locations), `git
  pull` it to bring it current before diffing anything. If no local clone
  exists, clone into the scratchpad/cache location this platform uses for
  such things, and record that path back into the lockfile for next time.
- Never fetch file-by-file with no commit/SHA reference at all — whichever
  path you take (API or clone), Step 3 needs a real "did this change since
  baseline" signal, not just a raw content diff with no history behind it.

## Step 3 — Classify each selected file

For every file belonging to a skill/agent selected in Step 1, compare
three things: the lockfile's recorded baseline hash, the file's current
content in the project, and the file's current content in the source
(fetched per Step 2).

| Project file vs baseline | Source file vs baseline | Meaning | Action |
|---|---|---|---|
| unchanged | unchanged | nothing moved | skip, report "up to date" |
| unchanged | changed | upstream updated it, project never touched it | **auto-update** — safe, project never diverged |
| changed | unchanged | this is a project-scoped override | skip — never touch, report as "intentionally customized" |
| changed | changed | both diverged since install | **conflict** — show a diff of both changes against the baseline, ask the user how to reconcile (take upstream, keep local, or manual merge); never auto-resolve |
| any | **removed/renamed upstream** | the skill/agent was deleted, split, or renamed in the catalog since install | never silently delete the project's copy — report it separately as "removed upstream" and ask whether to remove the local file, keep it as-is, or (if renamed) point the lockfile entry at the new path |

If the lockfile entry for a skill lists an **OpenCode command wrapper**
path (`.opencode/commands/<name>.md` or the global equivalent, created per
INSTALL.md Langkah 6), track and classify that file the same way as the
`SKILL.md` it wraps — a wrapper's body only calls `skill({ name: ... })`
with `$ARGUMENTS`, but its frontmatter `description` is copied from
`CATALOG.md` at install time, so if the catalog's description changed
upstream the wrapper goes stale even though the underlying skill file
didn't move. Diff the wrapper against what a freshly-generated wrapper
for the current `CATALOG.md` description would look like, and classify/
act on it with the same unchanged/changed rules above. If a project has a
tracked skill with no wrapper entry (installed before this convention
existed, or OpenCode wasn't selected at install time), don't invent one —
that's INSTALL.md's job, not skill-sync's; only flag it as "no wrapper
tracked" for the user's awareness if a `.opencode/commands/` directory
exists in the project but this skill's wrapper isn't in it.

## Step 4 — Apply and re-baseline

For every file actually updated (auto-update or user-confirmed conflict
resolution — including an OpenCode wrapper regenerated from a changed
`CATALOG.md` description): write the new content, then update that
entry's lockfile hash and `source_commit` to the new baseline. Files
skipped (unchanged, or intentional override the user chose to keep) keep
their existing lockfile entry untouched. For a file the user confirmed
should be removed (removed/renamed upstream case), delete it and drop or
repoint its lockfile entry accordingly — never delete without that
confirmation.

## Step 5 — Report

One summary, not scattered messages: which scope(s) were synced (project/
global/both, per Step 0), how many files were up to date, auto-updated
(list them, including any OpenCode wrapper regenerated alongside its
skill), skipped as intentional overrides (list them), removed/renamed
upstream (list them with what the user chose), and conflicts still
needing a decision (list them, with what was asked and what the user
chose). If a conflict was left unresolved because the user wanted to
review it later, say so explicitly rather than silently leaving it
pending.

## What this is not

- Not the initial install — that's `INSTALL.md`'s job; this skill assumes
  something is already installed and tracked.
- Not a way to force-overwrite a project's customizations — the whole
  point of the lockfile-based classification in Step 3 is to never touch
  a file the project intentionally diverged on without asking.
- Not `agent-doctor` — that verifies an installed agent actually runs on
  its platform (model access, frontmatter dialect); this only checks
  whether installed content is stale relative to its source.
