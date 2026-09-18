---
name: exec-todo
description: Use when the user wants to actually EXECUTE a plan/checklist file's feature items — triggers on "/exec-todo <file-or-slug>", "kerjakan fase X", "lanjutkan todo Y", or being pointed at a plan doc (from prd-grill's PRD+ISSUES pair, or a phase-plan file) to implement. Reads the given file, turns its unchecked feature checklist items into this session's tracked task list, then works through them in order — checking off both the session task list and the markdown checkboxes as each item is verified with cheap checks (tests/type-check/build) run immediately per item. Stops once every feature item is checked off — does NOT dispatch review or run full E2E/manual verification itself; that expensive closing-gate work is deliberately separate (see the `/qa`, `/gate`, `/promote` commands in this collection), so a full test/review pass isn't paid on every invocation. Not a planning skill (see prd-grill/brd-reader for that) — this one implements an already-written plan. Not for executing more than one plan file per invocation.
license: MIT
metadata:
  category: workflow
  author: lintang
  version: "2.0.0"
compatibility: "Requires a session task-tracking tool (TaskCreate/TaskUpdate or equivalent todo tool) and write access to the plan file to check off items."
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, TaskCreate, TaskUpdate, AskUserQuestion]
argument-hint: "<path-or-slug>"
disable-model-invocation: false
user-invocable: true
model: inherit
effort: medium
compatible_with: [claude-code, opencode, antigravity, commandcode]
---

# /exec-todo

Turn a plan/checklist file's **feature items** into an actively-tracked,
actually-implemented piece of work. [`prd-grill`](../prd-grill/SKILL.md)
(optionally preceded by [`brd-reader`](../brd-reader/SKILL.md)) writes the
plan; `exec-todo` implements it. See `references/project-example.md` for a
concrete worked example this skill was generalized from.

This skill is deliberately narrow: it stops once feature items are done. It
does **not** run the expensive review/QA-gate or full E2E/manual
verification pass — those live in the `/qa` (verify), `/gate` (review), and
`/promote` (ship) commands, run as separate, deliberate steps. This split
exists because bundling "implement" and "run the full test suite" into one
step meant a full test/review pass fired on every single invocation, even
for a one-line change — expensive in both time and tokens for no benefit
when nothing closing-gate-worthy has accumulated yet.

## Usage

```
/exec-todo <path>              # exact path to the plan/checklist file
/exec-todo <slug or number>    # fuzzy match — resolved in Step 0
/exec-todo                     # no argument: ask which file, don't guess
```

## Step 0 — Resolve the input to exactly one file

- If given a path, use it directly — still verify it exists, don't assume.
- If given a slug/number/fuzzy name, search this repo's plan-doc location
  (see [`prd-grill`'s output conventions](../prd-grill/references/output-conventions.md)
  for the two common shapes — both use a `todo/`→`done/` split: either
  `docs/prd/todo|done/<slug>/ISSUES.md`, or a `doc/phases/todo|done/...`
  phase file — match whichever this repo actually uses). Prefer a match in
  the `todo/` (still open) location; if the only match is already in
  `done/` (closed), tell the user its checklist is already fully checked and
  ask whether they meant a different, still-open file — don't silently
  re-execute a closed plan.
- If nothing matches, or the match is ambiguous, list the candidates and ask
  which one — don't guess at scope.
- If no argument was given at all, ask which file rather than defaulting to
  "whatever looks unfinished."

Read the resolved file **in full** before doing anything else — don't act on
a partial read or a summary from earlier in the conversation; it may have
changed since.

## Step 1 — Parse the checklist into a task list

Extract every unchecked `- [ ]` **feature** line from the file's checklist
section, in document order. Skip lines already `- [x]`, and skip fixed
closing items (review-dispatch, full E2E/manual verification, report
writing, todo→done move) — those are not this skill's job; the `/qa`,
`/gate`, and `/promote` commands own them respectively.

If every feature item is already `- [x]`: don't fabricate work. Tell the
user the feature work is done and point them to whichever of `/qa`/`/gate`/
`/promote` still has open closing items in the file.

Create the session's tracked task list from the extracted items — one task
per checklist line, same order as the document (order matters: later items
genuinely depend on earlier ones). Use whichever task-tracking mechanism
this session actually exposes (`TaskCreate`/`TaskUpdate`, or an equivalent
built-in todo tool) — don't invent an ad hoc scheme (a scratch markdown
file, a mental list) when a real tracked list is available; the point is an
explicit, inspectable todo that survives context compaction, not prose the
model has to re-derive each turn.

Each task's text should stay recognizable against the source checklist line
— don't paraphrase away the file/component name it names, so a later
checkmark can be matched back to the exact line without re-opening the file.

## Step 2 — Work through the list, one task at a time

For each task, in order:

1. Mark it in-progress in the session task tool.
2. Do the work. If the item is a genuinely multi-step implementation (not a
   one-line change), use the [`incremental-implementation`](../incremental-implementation/SKILL.md)
   skill's discipline for that item specifically — this skill governs
   *tracking*, not *how* to write the code. For behavior-changing work,
   [`test-driven-development`](../test-driven-development/SKILL.md) governs
   how the tests get written.
3. Verify it with the **cheap** checks only — unit tests / type-check /
   build for the touched area. Never run a full E2E/manual pass here; that
   belongs to `/qa`. Don't check off unverified work.
4. Mark the task completed in the session tool, **and** flip the
   corresponding `- [ ]` → `- [x]` in the actual plan file in the same turn
   — the two must stay in sync. The session task list is ephemeral (gone
   next conversation); the markdown file is the durable record. If the
   completed work deviates from the literal checklist wording (different
   file, reduced scope), still check it off with a short parenthetical note
   explaining the deviation.
5. If you discover necessary work that wasn't on the original checklist
   (e.g. an endpoint a frontend item actually needed), add it as a **new**
   task in the session list AND a new checklist line in the file — don't
   silently fold it into an existing item or omit it.

If you hit a genuine blocker on one item (ambiguous requirement, needs a
user decision), surface it via a choice-style question tool, resolve it,
then continue — don't silently skip it or reorder around it without saying
so.

## Step 3 — Stop and hand off

Once every feature item is checked off, stop. Do not dispatch review, do
not run E2E/manual verification, do not move the file to `done/` — say
plainly that feature work is done and the next steps are `/qa` (full
verification), then `/gate` (review), then `/promote` (ship/close-out).

## Step 4 — Final report

Summarize: what was implemented (by checklist item), cheap test/type-check
results, and which closing-gate commands (`/qa`/`/gate`/`/promote`) still
need to run. If something was genuinely left unchecked (blocked, descoped,
deferred), say so plainly and point to where that's noted in the file.

## What this skill is not

- Not a planning tool — it never edits the *plan content* of a file, only
  its feature checkboxes. Scope changes go through `prd-grill`'s refine
  flow to produce a new version, not through this skill rewriting the
  checklist it's executing.
- Not a substitute for `incremental-implementation`/`test-driven-development`
  for the actual coding work inside each item — this skill wraps those with
  tracking and file bookkeeping, it doesn't replace their discipline.
- Not the review or verification gate — see `/gate` and `/qa` for those.
  This skill never dispatches a reviewer agent or runs a full E2E/manual
  pass itself.
- Not for executing more than one plan file per invocation.
