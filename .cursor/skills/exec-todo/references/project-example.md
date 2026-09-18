# Worked example: a project-scoped exec-todo

**Note:** the generic `exec-todo` skill this reference informed no longer
owns a "Step 3 closing gates" section itself — that responsibility moved to
separate `/qa` (verification), `/gate` (review), and `/promote` (ship/
close-out) commands, so a full test/review pass isn't paid on every
`exec-todo` invocation. This worked example is kept for historical context
and because its lessons (definition-of-done is repo-specific, the
move-to-`done/` step is easy to silently skip) still apply — just to
`/promote` now instead of `exec-todo` Step 3.

A real chat-platform monorepo (the same one referenced in
`prd-grill`'s and `branching`'s worked examples) keeps a project-scoped
`exec-todo` at `.claude/skills/exec-todo/SKILL.md` because its generic
behavior (this skill) can't know the repo-specific "definition of done."
Kept here as the concrete reference this skill was generalized from.

## What the override adds beyond the generic skill

- **Exact file resolution rule:** search both the flat `todo/` root and the
  grouped `done/fase-{N}/` folders (that repo's Convention-B phase-plan
  layout) for a fuzzy match, preferring an open match, and refusing to
  silently "re-execute" a file already in `done/`.
- **A fixed six-step closing sequence**, taken verbatim from that repo's
  `CLAUDE.md` § "Before declaring a phase done": dispatch the `reviewer`
  subagent, run an actual Playwright MCP pass against the running app (not
  just `tsc`/unit tests), write a `qa-history/{phase}/{date}_{kind}/` report
  with screenshots, clean up test data/dev processes, check off the closing
  items, then `git mv` the file into `done/fase-{N}/` and fix relative links
  in it and anything pointing to it.
- **A specific incident that motivated step 6 being explicit:** the
  move-to-`done/` step used to live in a different section of that repo's
  `CLAUDE.md` than the rest of the closing checklist, and was getting
  skipped in practice — files sat fully-checked in `todo/` indefinitely.
  The override folds it into the same numbered sequence specifically to
  stop that from recurring. This is a good example of *why* a
  project-scoped override earns its keep: the generic skill can describe
  the shape of a closing-gate sequence, but it can't know a specific past
  failure mode worth hard-coding a fix for.
- **Delegation to `incremental-implementation` for multi-step items**,
  matching this generic skill's Step 2 exactly — this part didn't need
  overriding, which is itself useful information: it tells you the generic
  skill's Step 2 was already a good fit for that repo.

## Takeaway for writing your own override

Same pattern as `prd-grill`'s override guidance: Steps 0-2 and 4 (file
resolution, task-list mechanics, final report) rarely need repo-specific
changes — they're mechanical. **Step 3 (the closing gates) is almost always
where a project-scoped override earns its keep**, because "definition of
done" is inherently repo-specific: what verification tooling exists, what
report format is expected, whether there's a review subagent to dispatch,
and whether completed plan files move to a different location. Write the
override by copying this repo's own documented definition-of-done verbatim
into Step 3, not by guessing at a generic one.
