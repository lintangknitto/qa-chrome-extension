# Task breakdown technique (for ISSUES.md)

Used from Step 5 of `prd-grill` when the checklist items being written for
`ISSUES.md` aren't obviously small — apply this before finalizing the
checklist, not as a separate pass or separate output file. This folds in
what used to be a standalone `planning-and-task-breakdown` skill (adopted
from addyosmani/agent-skills); it's technique, not a skill of its own, and
it writes into the same `ISSUES.md` this repo already uses — never into a
separate `tasks/plan.md`/`tasks/todo.md` pair.

## When to reach for this

- An ISSUES.md item touches more than ~5 files, or you can't state its
  acceptance criteria in 3 or fewer bullets.
- The item's title needs "and" to describe it (a sign it's actually two
  items).
- It touches two or more independent subsystems (e.g. auth and billing).
- Work could be parallelized across multiple items and the natural order
  isn't obvious yet.

If none of these apply, skip this — writing one plain checklist item is
enough and adding process here is pure overhead.

## Map the dependency graph first

Before ordering items, sketch what depends on what (schema → API →
frontend client → UI, roughly bottom-up). Order the checklist so
foundational items come first — an item that needs another item's output
should never appear before it in ISSUES.md.

## Slice vertically, not horizontally

Prefer items that each deliver one complete, testable path over items that
each complete one *layer* across everything:

**Avoid (horizontal):** "Build schema" / "Build all endpoints" / "Build all
UI" / "Wire it together" — nothing is testable until the last item lands.

**Prefer (vertical):** "User can create an account (schema+API+UI for
registration)" / "User can log in (auth schema+API+UI)" — each item is a
working, testable slice on its own.

## Size each item

| Size | Files | Guidance |
|---|---|---|
| XS | 1 | fine as-is |
| S | 1-2 | fine as-is |
| M | 3-5 | fine as-is |
| L | 5-8 | split further |
| XL | 8+ | must split — never leave an XL item in the final checklist |

An item sized L or XL goes back through this same process (dependency
graph → vertical slice → re-size) until every resulting item is S/M.

## Write each item with acceptance criteria, not just a title

Every `- [ ]` line in ISSUES.md should be traceable to a concrete, testable
condition — not "implement the feature." If an item can't be checked off
against without asking "did we build the right thing?", it needs sharper
acceptance criteria before it's finalized, not after.

## Checkpoints for multi-item plans

For plans with more than ~4-5 items, insert an explicit checkpoint line
after every 2-3 items in ISSUES.md (e.g. "Checkpoint: tests pass, core flow
works end-to-end") — this is in addition to, not a replacement for, this
repo's fixed closing "definition of done" items that `prd-grill` Step 5
already appends verbatim.

## Common rationalizations to reject

| Rationalization | Reality |
|---|---|
| "The tasks are obvious" | Write them down anyway — explicit items surface hidden dependencies. |
| "I can just make one big item" | An unsizeable item is exactly what `exec-todo` will stall on mid-execution. |
| "Sizing is overhead for a small PB" | Skip this whole technique for small PBs — see "When to reach for this" above. |
