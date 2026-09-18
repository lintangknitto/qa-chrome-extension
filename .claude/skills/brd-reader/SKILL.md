---
name: brd-reader
description: Use when the user already has a Business Requirements Document (BRD) — written by a system/business analyst — as raw text or a file (doc/pdf/md/etc.), and needs it read and understood before implementation planning. Triggers on "/brd-reader", "baca BRD ini", "pahami BRD ini", "ini BRD dari analyst, tolong review", or when a backlog item arrives with an attached/pasted BRD instead of a bare description. Reads the BRD, extracts process-flow/UI/data-dictionary impact and anything ambiguous or missing, confirms the understanding with the user, then hands off to prd-grill to turn it into an implementable checklist/todo. Does NOT author a new BRD from scratch — writing a BRD is a business/system-analyst responsibility, not this skill's job. Not for backlog items with no BRD at all (go straight to prd-grill for those).
license: MIT
compatibility: "Requires a way to read files and, ideally, an AskUserQuestion-style tool for confirmation."
metadata:
  category: planning
  author: lintang
  version: "2.0.0"
allowed-tools: [Read, Glob, Grep, AskUserQuestion, Skill]
argument-hint: "[path to BRD file] | paste BRD text | refine <slug>"
when_to_use: "Also trigger when the user pastes raw BRD content (sections like tujuan/latar belakang/proses bisnis/kebutuhan data) and asks for it to be understood, summarized, or turned into a plan."
disable-model-invocation: false
user-invocable: true
model: inherit
effort: medium
compatible_with: [claude-code, opencode, antigravity, commandcode]
---

# /brd-reader

Read and understand a **Business Requirements Document (BRD)** that a
business/system analyst has already written — as pasted text or an attached
file — then hand off to [`prd-grill`](../prd-grill/SKILL.md) to turn the
understood requirements into an implementable checklist/todo.

This skill never authors a BRD from scratch. Producing a BRD is a business/
system-analyst deliverable; this skill's job is to make sure the agent (and
the developer) genuinely understand an *already-written* one before planning
implementation. If no BRD exists yet for a backlog item, that's not this
skill's job — go straight to `prd-grill`.

## Usage

```
/brd-reader <path to BRD file>       # read a BRD from a file
/brd-reader                           # ask for the BRD (paste text or file path)
/brd-reader refine <slug>             # re-read an updated BRD for a backlog item already in progress
```

## Step 1 — Get the BRD

If the user already pasted BRD text or pointed at a file, use that directly.
Otherwise ask for it — accept either pasted text or a file path (doc/pdf/md/
txt/whatever this repo's analysts hand off in). Don't proceed on a vague
backlog description with no actual BRD content; if the user doesn't have one,
say so and suggest `prd-grill` directly instead.

## Step 2 — Extract understanding

Read the full BRD and extract, in the analyst's own terms first (don't
jump straight to implementation language):

- **What is being requested** — the core business need/problem this BRD
  addresses.
- **Process/flow impact** — does it change an existing business process, and
  how (before → after)? Note if the BRD leaves this unclear.
- **UI impact** — which screens/forms are touched, new vs. existing, by
  name/ID if the BRD gives one.
- **Data dictionary impact** — new or changed stored fields/entities.
- **Out of scope** — what the BRD explicitly excludes.
- **Gaps or ambiguities** — anything the BRD asserts but doesn't fully
  specify (e.g. "update the report" without saying which fields), anything
  contradictory across sections, or anything an implementer would need but
  the BRD doesn't state.

## Step 3 — Confirm understanding with the user

Summarize the extracted understanding above, explicitly flagging any gaps/
ambiguities found in Step 2. Ask the user to confirm, correct, or fill in
the gaps — don't silently guess at ambiguous requirements. If the user can't
resolve a gap themselves, note it as an open question to carry into
`prd-grill` rather than blocking indefinitely.

## Step 4 — Hand off to prd-grill

Once understanding is confirmed, invoke [`prd-grill`](../prd-grill/SKILL.md)
and pass it:
- The BRD file/text itself (or its path), so it has full source context
  instead of re-deriving it.
- The confirmed understanding from Step 2-3 (process/UI/data impact, scope,
  any open questions) so `prd-grill`'s own grill loop doesn't re-ask what's
  already known from the BRD — it should only ask genuinely new
  implementation-level detail (which files, which endpoints).

Don't let `prd-grill` re-litigate scope decisions the BRD already settles —
the BRD is the source of truth for *what*, the todo/plan is for *how*.

## Step 5 — Re-read on refine

If the user says the BRD was updated (`refine <slug>` or equivalent intent),
re-read it, diff the understanding against what was previously confirmed
(check the linked `prd-grill` plan doc if one already exists for this
backlog item), and surface only what changed before re-confirming.

## What this skill is not

- Not a BRD author — never draft, template, or write a new BRD; that's a
  business/system-analyst responsibility outside this skill's scope.
- Not an implementation planner — that's `prd-grill`'s job, always hand off
  rather than duplicating checklist generation here.
- Not for backlog items with no BRD at all — send those straight to
  `prd-grill`.
- Not for editing code.
