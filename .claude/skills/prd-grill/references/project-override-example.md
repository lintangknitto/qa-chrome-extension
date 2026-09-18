# Worked example: a project-scoped override

A real repo (a multichannel chat monorepo) uses Convention B (versioned
phase-plan files, see `output-conventions.md`) with several project-specific
rules that a generic grill can't know in advance. Rather than re-deriving
these each session, the repo keeps its own override at
`.claude/skills/prd-grill/SKILL.md` (same `name: prd-grill`, so it takes
precedence over the generic skill within that repo) that:

- States the exact folder rule: unfinished phases live flat in
  `doc/phases/todo/`, finished ones move to `doc/phases/done/fase-{N}/`,
  and a family can straddle both (some decimals done, some still open).
- Encodes a hard-won lesson as a standing rule: a request was first written
  as a new top-level phase, then had to be renamed once it became clear it
  was really a continuation of an existing phase family — so the override
  states explicitly "default to `.M` chaining whenever a plausible existing
  family exists" and gives the concrete criteria for when a new number is
  actually justified (opens a new surface, not just "also touches a second
  app").
- Names the exact fixed closing checklist items this repo requires, in
  order, verbatim — e.g. a specific test command, a specific reviewer
  subagent dispatch instruction, a specific browser-verification step with
  a report location — so the grill never has to guess or paraphrase them.
- Points to which existing phase file to study as the nearest-neighbor
  template for a new phase, based on what kind of feature it is (data
  surface vs. UI refine vs. new backend+frontend feature), instead of
  inventing a template from scratch each time.
- Explicitly says completed phase files are never edited in place — a
  later change is always the next `.M` file — because Convention A's
  "move back to `todo/` and edit" behavior doesn't apply once a repo has
  committed to append-only phase history; Convention B never reopens a
  `done/` file at all.

## Takeaway for writing your own override

A good project-scoped override is not a rewrite of this skill's grill loop
(Steps 1-4 stay the same everywhere) — it's a **replacement of Step 5's
output section and Step 0's convention-detection**, made concrete: exact
folder paths, exact section names, exact fixed checklist items, and any
numbering/versioning rules specific to that repo. Keep the override in the
same skill-discovery location the platform expects (e.g.
`.claude/skills/prd-grill/SKILL.md` for Claude Code) so it's picked up
automatically in place of this generic one.
