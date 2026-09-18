---
name: prd-grill
description: Use when the user wants to turn a rough idea into a concrete, actionable plan through iterative Q&A — triggers on "/prd-grill", "grill me", "grill this feature", "let's plan this out", "help me spec this", or when starting a new feature/project with no PRD or plan doc yet. Asks one question at a time, adapts based on prior answers and the existing codebase, confirms understanding, then always writes a PRD + ISSUES pair under `docs/prd/todo|done/` (see references/output-conventions.md) — a fixed format, not inferred from whatever the repo already happens to have lying around. Not for trivial one-line tasks that don't need a written plan, and not for re-deriving a plan that already exists — use the refine/update flow instead.
license: MIT
compatibility: "Requires a way to write files and, ideally, an AskUserQuestion-style tool for choice questions (falls back to plain text Q&A otherwise)."
metadata:
  category: planning
  author: lintang
  version: "1.0.0"
allowed-tools: [Read, Write, Edit, Glob, Grep, AskUserQuestion]
argument-hint: "[topic or feature] | refine <slug>"
when_to_use: "Also trigger proactively when the user describes a feature at a level too vague to implement directly (e.g. 'add some kind of notification system') rather than waiting for the literal /prd-grill invocation."
disable-model-invocation: false
user-invocable: true
model: inherit
effort: medium
compatible_with: [claude-code, opencode, antigravity, commandcode]
---

# /prd-grill

Turn a rough idea into a written plan by grilling the user with one adaptive
question at a time — never a wall of questions upfront — then writing a plan
document to disk once scope is confirmed.

This skill always writes the **same fixed format**: a PRD + ISSUES pair
under `docs/prd/todo|done/<slug>/` (Step 5). It does **not** scan the repo
for some other planning convention and defer to it — a skill that adapts
its output shape to whatever it finds produces a different structure in
every repo, which defeats the point of having a standard shape at all. If a
repo genuinely wants a different fixed shape (e.g. versioned phase-plan
files), that's a deliberate **project-scoped override** the repo's owner
writes once — see `references/project-override-example.md` — not something
this generic skill infers on the fly.

## Usage

```
/prd-grill                      # ask what we're planning, then start grilling
/prd-grill <topic or feature>   # start grilling directly on that topic
/prd-grill refine <slug>        # reopen an existing plan doc, grill only the delta
```

## Being invoked after brd-reader

If this invocation comes as a hand-off from
[`brd-reader`](../brd-reader/SKILL.md) (a BRD file/text and its confirmed
understanding were passed in), treat the BRD as the source of truth for
*what* — don't re-ask process/UI/data-impact questions already answered
there. Read the BRD in full, then jump straight to Step 3 asking only
genuinely new, implementation-level questions (which files, which
endpoints, which components) that the BRD wouldn't have covered.

## Step 1 — Scope: new plan vs. correction to an existing one

Ask (or infer from the invocation) whether this grill is:
- **A brand-new plan** — a feature/area with no matching doc yet.
- **A correction/extension to an existing plan** — recognize this from
  intent even if the user didn't type `refine` literally (e.g. "the inbox
  layout from last time needs a redo" is a refine, not a new plan).

Default to extending an existing doc rather than minting a new one whenever
a plausible existing doc covers the same topic/surface, even if the concrete
change also touches a different area than the original did. Reserve a
brand-new doc for work that opens a genuinely new surface with no natural
parent to attach to. If ambiguous, ask — but the default lean is to extend,
not to mint new.

## Step 2 — Initialize session

**If new plan:**
- Pick a short kebab-case `slug` describing the feature.
- Do a **quick**, targeted pass over the relevant part of the codebase
  (Glob/Grep, or an Explore-style agent if available — not exhaustive) to
  build a mental map of what already exists. Existing files/folders don't
  prove a feature is implemented — verify, don't assume.
- Open with one framing question: the problem this solves, or (for a
  correction) what's wrong with the current state. Not a wall of questions.

**If refining an existing plan:**
- Locate the existing doc(s) for that slug/topic and read the latest
  version in full — don't re-derive its content from memory.
- Open by asking what's changing relative to that version.

## Step 3 — Grill loop: one question at a time

- Ask exactly one question per turn. Prefer a choice-style tool (e.g.
  AskUserQuestion) for questions with a small set of options, marking your
  best guess as recommended; use plain text for open-ended questions.
- Adapt each next question based on prior answers — don't run a fixed
  script. Skip anything already answered or obvious from context.
- Ground to cover (skip what's already clear):
  - Problem / motivation — why this, why now
  - Concrete scope — what changes, in which files/modules/domains
  - Data/API surface — new endpoints, schema changes, contracts touched
  - Explicit out-of-scope — ask for this directly, don't let it be an
    afterthought
  - Success criteria / how this gets verified done
- If the user's answer contradicts an earlier one, surface the
  contradiction and ask which stands — never silently overwrite.

## Step 4 — Confirmation

Summarize your understanding — problem, scope, key sections you intend to
write, key decisions from the grill — and ask the user to confirm or
correct before generating anything. If they request changes, loop back to
Step 3 for the affected part only, then re-summarize. Don't write files
before this confirmation.

## Step 5 — Generate output

Always the same shape: a **PRD + ISSUES pair**, always written under
`todo/` first — never directly under `done/`:

```
docs/prd/todo/<slug>/PRD.md       # problem, scope, design decisions, out-of-scope
docs/prd/todo/<slug>/ISSUES.md    # actionable checklist broken into implementable items
```

It moves to `docs/prd/done/<slug>/` only once `exec-todo` (or equivalent)
fully checks off `ISSUES.md` — that's a close-out step, not something this
skill does at write time.

See `references/output-conventions.md` for the full PRD.md/ISSUES.md
section-by-section shape and the todo/done move rules. That file also
documents an alternative single phase-plan-file convention for reference —
that shape only applies if this repo has a project-scoped override (Step 6)
that explicitly says to use it; this generic skill never switches to it on
its own.

Whichever shape applies, always include:
- Context: what this is, why, and links to anything it depends on
- The scope decisions from the grill, not generic boilerplate
- An explicit "out of scope" section, even if short
- A checklist-style breakdown for implementation — one item per
  component/endpoint/test file, not one giant item. If a natural item would
  touch more than ~5 files, can't state acceptance criteria in 3 bullets, or
  spans independent subsystems, apply
  `references/task-breakdown-technique.md` (dependency graph, vertical
  slicing, sizing) to split it before writing the final checklist — don't
  leave an oversized item in ISSUES.md.
- If this repo has a fixed "definition of done" (tests pass, review step,
  manual/E2E verification step) documented anywhere (CLAUDE.md, CONTRIBUTING,
  etc.), append those as fixed closing checklist items verbatim — don't
  paraphrase them away even if the feature seems small.

Write the file(s) directly — don't ask permission to write, that's the
point of the skill — but tell the user the exact path(s) afterward.

## Step 6 — Offer a project-scoped override, if asked for one

Only if the user explicitly says this repo needs a different fixed shape
than PRD+ISSUES (different folder layout, different section names, a
versioning scheme like `.M` chaining) — never infer this from scanning the
repo — write a **project-scoped override**: a copy placed at the project's
own skill location with `name: prd-grill` that fully describes the repo's
real convention, so future invocations use it directly instead of this
generic default. See `references/project-override-example.md` for a worked
example of what a good override looks like.

## Step 7 — Refinement loop (if the user comes back later)

If the plan is still in `todo/<slug>/`, update `PRD.md`/`ISSUES.md` in
place, noting what changed and why in a short changelog note at the top. If
it already moved to `done/<slug>/`, move it back to `todo/<slug>/` first
(new work reopens it), then edit in place with the same changelog note —
never edit a `done/` file in place and leave it there.

(A project-scoped override with a versioned/phase-plan convention instead
follows its own refinement rule — see that override's own instructions, not
this generic skill's.)

## What this skill is not

- Not a substitute for actually tracking progress as work happens — this
  skill only produces the plan. See [`exec-todo`](../exec-todo/SKILL.md) to
  execute the checklist this skill writes.
- Not a way to skip whatever review/verification steps this repo requires —
  those belong in the generated checklist (Step 5), not negotiated away.
- Not for editing code — this skill only writes planning documents.
