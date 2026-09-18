# Output conventions

The generic `prd-grill` skill always writes **Convention A** — it does not
scan a repo and switch shape based on what it finds. Convention B is
documented here only as a reference for writing a **project-scoped
override** (SKILL.md Step 6) for a repo that deliberately wants a different
fixed shape; the generic skill never picks it on its own.

Both conventions use the same **`todo/` → `done/` flow** so a repo's plan
docs always show at a glance what's still open vs. finished — never mix a
convention that has this split with a flat, unsplit folder.

## Convention A — PRD + ISSUES pair (always used by the generic skill)

```
docs/prd/
  todo/                    # unfinished plans — always flat
    <slug>/
      PRD.md
      ISSUES.md
  done/                     # finished plans
    <slug>/
      PRD.md
      ISSUES.md
```

Use for repos with no existing planning folder, or for one-off features in
a codebase that doesn't track work as versioned "phases."

Rules:
- A brand-new plan always starts in `todo/<slug>/` — it hasn't been
  implemented yet.
- A plan moves `todo/<slug>/` → `done/<slug>/` only once `ISSUES.md` is
  fully checked (or every remaining item is explicitly annotated N/A / out
  of scope) — as part of implementation close-out (`exec-todo`'s job), not
  something `prd-grill` does itself.
- Refining a plan still in `todo/`: edit `PRD.md`/`ISSUES.md` in place,
  noting what changed and why in a short changelog note at the top of
  `PRD.md`.
- Refining a plan already in `done/`: move it back to `todo/<slug>/` first
  (new work reopens it — its checklist is no longer fully representative of
  "done"), then edit in place with the same changelog note. Never edit a
  `done/` file in place and leave it there.

**`PRD.md` sections:**

```markdown
# <Feature Title>

## Context
What this is, why it's needed, links to related docs/features.

## Problem / Motivation
Why this, why now.

## Scope
What's included, described concretely (files/modules/domains touched).

## Design decisions
Key choices made during the grill and why (data model, API shape, UX
approach) — not implementation detail, the *decisions*.

## Out of scope
Explicit list. Always present, even if short.

## Success criteria
How this gets verified as done.
```

**`ISSUES.md`:** a flat checklist, one item per implementable unit (one
component, one endpoint, one test file — not one giant "implement the
feature" item), plus this repo's fixed definition-of-done items appended
verbatim if any exist (tests pass, review step, E2E/manual verification).

## Convention B — Single versioned phase-plan file (override-only)

Not used by the generic skill by default — only relevant if a repo has
written a project-scoped override that adopts it. Some repos track work as
numbered "phases," each phase a single
self-contained plan file, with corrections handled by **chaining a decimal
version** rather than editing the file or minting a new phase number. This
scales well for long-lived features that get revisited many times (a real
example reached `.16` — sixteen chained corrections to one phase).

```
doc/phases/
  todo/                          # unfinished phases — always flat
    fase-{N}-{slug}.md
    fase-{N}.{M}-{slug}.md       # correction/extension, M = decimal version
  done/                           # finished phases — grouped by family
    fase-{N}/
      fase-{N}-{slug}.md
      fase-{N}.{M}-{slug}.md
      ...
```

Rules:
- A brand-new file always starts in `todo/` (flat) — it hasn't been
  implemented yet.
- A file moves `todo/` → `done/fase-{N}/` only once its checklist is fully
  checked (or every remaining item is explicitly annotated N/A / out of
  scope) — as part of implementation close-out, not by the planning skill.
- A correction/extension to an existing phase becomes the **next decimal**
  (highest existing `.M` + 1, computed automatically — never asked of the
  user), not a new top-level phase number, whenever it shares a
  topic/surface with an existing phase — even if the concrete change also
  touches a different area than the original phase did.
- Reserve a new top-level number only for work that opens a genuinely new
  surface with no natural parent phase.
- Completed phase files are **never edited in place** once they've guided
  real work — a later change is always the next `.M` file, so history stays
  intact.

**Single file's shape:**

```markdown
# Fase {N}[.{M}] — {Title}

> Context blockquote: what this is, what it depends on (link to the phase
> it builds on), and — for a .M file — what changed relative to the
> previous version, linked by name.

## <sections tailored to what the grill surfaced>
Prefer this repo's existing idioms over generic prose — e.g. a numbered
"concrete problems" list for a UI refine, a data/column table for a
data-surface feature, explicit target file + line-range pointers when
refining known files. Look at the nearest-neighbor existing phase file and
match its shape rather than inventing a new template each time.

## Out of scope
Always present.

## Checklist
- [ ] granular implementation items — one per component/endpoint/test file
- [ ] <this repo's fixed definition-of-done items, verbatim, every time>
```

## Recognizing which convention (or neither) a repo uses

- A `doc/phases/` or similarly named folder with `todo/`/`done/` and
  decimal-suffixed filenames → Convention B. Read 2-3 existing files to
  learn the repo's exact section names and fixed checklist items before
  writing a new one — don't assume they match this reference exactly.
- A `docs/prd/` folder (with or without an existing `todo/`/`done/` split —
  treat a flat `docs/prd/<slug>/PRD.md` from before this convention existed
  as Convention A too, and migrate it into `todo/` or `done/` based on
  whether its `ISSUES.md` is fully checked), or no planning folder at all →
  Convention A.
- Neither, but the repo has a `CLAUDE.md` / `CONTRIBUTING.md` describing a
  different planning shape entirely → follow that instead of either
  convention here, and flag to the user that a project-scoped override
  (SKILL.md Step 6) would be worth writing.
