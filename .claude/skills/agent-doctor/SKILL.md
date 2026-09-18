---
name: agent-doctor
description: Verify that subagents installed in a project (e.g. reviewer, qa-engineer) can actually run on the user's current platform — correct file location, valid frontmatter for that platform's dialect, and a model the user actually has access to (subscriptions differ per person and per platform) — then help fix whatever's broken. Use after installing agents into a repo, when a subagent fails to invoke or errors out, or when the user asks to "check if my agents work" / "set up the model for this agent". Not for creating new agents from scratch (see agents/README.md's authoring pattern in this catalog) or for the underlying project's own runtime (see project-bootstrap for that).
license: MIT
metadata:
  category: foundation
  author: lintang
compatible_with: [claude-code, opencode, antigravity, commandcode]
---

# Agent Doctor

A subagent file sitting in the right folder with correct-looking
frontmatter can still fail to actually run — a `model:` alias the user's
plan doesn't have access to, a platform-specific field missing, or the
file simply in the wrong location for that platform's convention. This
skill diagnoses that gap and helps fix it, instead of assuming "the file
exists" means "it works".

## When to use

- Just installed one or more subagents into a project and want to confirm
  they're actually invokable before relying on them.
- A subagent fails to trigger, errors on invoke, or behaves like it never
  ran.
- The user asks to "check if my agents work", "set up the model for this
  agent", or "make sure reviewer/qa-engineer runs".

## When NOT to use

- Writing a brand-new agent from scratch — that's authoring, not
  diagnosis; follow this catalog's agent-authoring pattern (thin
  orchestration delegating to a skill) instead.
- Verifying the underlying *project* runs (dependencies, build, dev
  server) — that's `project-bootstrap`, a different layer entirely.

## Steps

1. **Ask which platform(s) the user is running right now** (Claude Code,
   OpenCode, Antigravity, Command Code, Cursor, Codex CLI) — don't guess
   from file presence alone, since a project can have agent files for
   multiple platforms installed but the user only actively uses one or
   two of them day to day.

2. **Locate every agent file for that platform.** See
   `references/platform-agent-specs.md` for the file-location convention
   per platform. List what's found — and just as importantly, what's
   *expected but missing* (e.g. a project's docs mention a `qa-engineer`
   agent but no file exists at the platform's expected path for it).

3. **Validate structure per file**, per platform's required frontmatter
   (see the reference table):
   - Required fields present and non-empty (not a leftover template
     placeholder).
   - File in the exact location/filename convention that platform reads —
     a single wrong folder or missing extension silently makes the agent
     invisible to that platform, with no error message anywhere.
   - For Codex CLI specifically: confirm it's actually TOML with
     `developer_instructions` set, not accidentally a Markdown+YAML file
     copied from another platform's convention.

4. **Check the model field — this is where most "installed but broken"
   agents actually fail.** Never assume a model alias/string is valid or
   available:
   - Show the user exactly what `model:` value is set.
   - Ask the user to confirm they have access to that model under their
     current plan/provider for this platform — subscriptions and
     available models differ per person and change over time, so this
     can't be inferred, only asked or checked against the platform's own
     model listing (see the reference file for where each platform
     surfaces that).
   - If the user doesn't have access, or isn't sure, help them find a
     model they do have access to (point at the platform's own model
     picker/config as source of truth) and update the `model:` field —
     **confirm with the user before editing the file**, since it's a
     change to their repo.

5. **Live-invoke test, when possible.** If the current running session's
   platform matches the agent being checked (e.g. this is a Claude Code
   session checking a Claude Code subagent), actually invoke it with a
   trivial, harmless prompt (e.g. "reply with OK and nothing else") via
   that platform's own subagent-invocation mechanism, and confirm it
   responds without an error (unknown model, missing tool, malformed
   frontmatter all surface here). This is the strongest signal available
   — a file that looks structurally correct can still fail at invoke
   time for reasons static checks can't catch.

   When the platform being checked isn't the one currently running (e.g.
   checking a Cursor agent from a Claude Code session), a live test isn't
   possible from here — give the user the exact manual command/action to
   test it themselves in that platform, and ask them to report back what
   happened.

6. **Report per agent, per platform**: works / doesn't work / couldn't be
   tested live, and for anything broken, what was found and what was
   fixed (or what the user needs to do, if it needs their action — e.g.
   picking a model only they can confirm access to).

## Reference

- `references/platform-agent-specs.md` — file locations, required
  frontmatter, and model-field conventions per platform, plus why model
  validity can't be hardcoded and when live-invoke testing is possible.
