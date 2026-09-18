---
name: project-bootstrap
description: Calibrate an AI coding agent to a project it hasn't worked in before — detect the stack/tooling, install dependencies, verify the project actually runs (dev server/build/test), and write or update CLAUDE.md/AGENTS.md with what was found and verified. Use at the start of work on a new or unfamiliar repo, or when the user asks to "onboard"/"bootstrap"/"set up this project for the agent". Not for installing skills from this catalog into another repo (see INSTALL.md at this repo's root for that) — this is for calibrating to *any* target project's own stack, run once per project, not every session.
license: MIT
metadata:
  category: foundation
  author: lintang
compatible_with: [claude-code, opencode, antigravity, commandcode]
---

# Project Bootstrap

Turns "an agent just landed in an unfamiliar repo" into "an agent that
knows the stack, has verified the project runs, and has a CLAUDE.md/
AGENTS.md to prove it" — a foundation step, not an every-session ritual.
Unlike a plain doc-generator, this skill doesn't just describe the
project — it actually installs dependencies and tries running it, so the
documentation it writes reflects commands that were just verified to work,
not assumed.

## When to use

- Starting work on a repo this agent hasn't touched before, and there's no
  `CLAUDE.md`/`AGENTS.md` explaining how to run the project yet.
- The user explicitly asks to "onboard this project", "bootstrap this repo
  for the agent", or similar.
- An existing `CLAUDE.md`/`AGENTS.md` is clearly stale (mentions commands
  that no longer exist, a stack that's since been swapped out).

## When NOT to use

- `CLAUDE.md`/`AGENTS.md` already exists and is up to date — just read it,
  don't re-bootstrap every session.
- What's actually needed is installing skills from this `agent-skills`
  catalog into another project — that's `INSTALL.md` at this repo's root,
  not this skill (different thing: that's installing skills, this is
  calibrating to a project's own stack).
- A large monorepo with many subprojects on different stacks — run this
  skill per relevant subfolder instead of forcing one confusing combined
  summary.

## Steps

1. **Detect the stack.** Run `scripts/detect_stack.py` (stdlib-only,
   read-only — never installs or runs anything) from the target project's
   root:

   ```bash
   python scripts/detect_stack.py [path-to-project]
   ```

   This recognizes the Node package manager (pnpm/yarn/bun via
   lockfile), other stack markers (Python, Go, Rust, PHP, Ruby, Java,
   Elixir), existing docs (`CLAUDE.md`/`AGENTS.md`/`README.md`), CI
   config, containers, tests, and linting. If no marker matches, that's a
   signal it might be a monorepo — check subfolders manually before
   continuing.

2. **Confirm the install plan with the user before executing.** Installing
   dependencies and running project commands are actions with real
   side effects (`pnpm install`, `pip install`, etc. can run third-party
   scripts) — always show the command that's about to run and get
   confirmation first, don't execute silently, per the "Executing actions
   with care" guidance in the base agent instructions.

3. **Install dependencies.** Run the install command matching what step 1
   detected (e.g. `ppnpm install`, `pip install -r requirements.txt`). If
   it fails, don't proceed pretending it worked — report the error as-is
   to the user.

4. **Verify the project actually runs.** Depending on what's found in
   `package.json`/`Makefile`/etc., try:
   - Build (`pnpm build`, `go build`, `cargo build`, etc.) — the
     cheapest signal that "the code is valid".
   - The test suite if one exists (`pnpm test`, `pytest`, etc.) — it
     doesn't have to be all-green (a project may legitimately have tests
     that don't pass yet), but record the result honestly.
   - Dev server/start command — if this is a long-running process, don't
     let it block; run it briefly to confirm it doesn't crash on startup
     (see the `run` skill for a more complete launch-and-verify pattern if
     actually checking the UI is needed), then stop it.

   The outcome of each command (succeeded/failed, relevant output) gets
   recorded — that's what makes the documentation this skill writes
   different from documentation that's just guessed from `package.json`.

5. **Write or update `CLAUDE.md`/`AGENTS.md`.** Follow the same rule as
   step 6 of `INSTALL.md` in this repo:
   - If the file **already exists**, don't overwrite it — offer to add a
     new section (or update a stale one) with the results from steps 1–4.
   - If it **doesn't exist yet**, offer to create it (ask `CLAUDE.md` vs
     `AGENTS.md` if it isn't clear from the user's agent platform), with
     at minimum:
     - A project summary (from `README.md` if present, or ask the user).
     - The detected stack & package manager.
     - Install/build/test/dev commands that were **just verified to
       work** — not guessed, and clearly noting anything that failed so
       the next agent doesn't repeat the same mistake.
     - Conventions that can be inferred from existing files (folder
       structure, linter, formatting) — don't make things up if unsure,
       just skip that part.
   - **Always confirm first** before writing a new file into the user's
     repo — never do it silently.

6. **(Optional) Suggest relevant skills from the `agent-skills` catalog.**
   If the user is also the owner/contributor of this `agent-skills` repo
   (or asks for it), check `CATALOG.md` and mention which skills are
   relevant to the newly detected stack (e.g. `webapp-testing`/
   `e2e-testing` for a frontend, `database-migrations` for a Prisma/
   migration folder) — offer, don't install automatically. This isn't a
   required step, just a bonus when the context fits.

## Reference

- `scripts/detect_stack.py` — read-only scanner for step 1, stdlib-only
  Python, safe to run without confirmation since it never changes
  anything.
