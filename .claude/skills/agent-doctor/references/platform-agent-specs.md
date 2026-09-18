# Per-platform subagent file specs

Self-contained reference — doesn't depend on any other repo's docs, so
this stays correct when this skill is installed into a project that
doesn't have `agent-skills`' own `agents/README.md` around. If a platform
changes its format, this file is the one to update.

| Platform | File location (project) | File location (global) | Required frontmatter | Model field |
|---|---|---|---|---|
| Claude Code | `.claude/agents/<name>.md` | `~/.claude/agents/<name>.md` | `name`, `description` | `model:` — short alias (e.g. `sonnet`, `opus`, `haiku`, `inherit`) |
| OpenCode | `.opencode/agents/<name>.md` | per OpenCode config | `description` (body = system prompt) | model set via `mode`/provider config, not always in the agent file itself — check OpenCode's own config for the active model |
| Antigravity | `.agents/agents/<name>.md` or `.agents/agents/<name>/agent.md` | `~/.gemini/config/agents/<name>.md` | `name`, `description`, `subagent: true` (to be invokable) | model typically inherited from the calling session, not per-agent |
| Command Code | `.commandcode/agents/<name>.md` | `~/.commandcode/agents/<name>.md` | `name`, `description` | `model:` field, format depends on Command Code's configured provider |
| Cursor | `.cursor/agents/<name>.md` | `~/.cursor/agents/<name>.md` | filename = agent identity | `model:` — must match a model Cursor's own model picker shows as available |
| Codex CLI | `.codex/agents/<name>.toml` | `~/.codex/agents/<name>.toml` | `name`, `description`, `developer_instructions` (TOML, not Markdown+YAML) | `model` — full model string, must match what's configured/available in the Codex CLI provider config |

## Why the model field can't be validated from a hardcoded list

Model names change frequently and access depends entirely on the user's
subscription/provider setup for that platform — a model alias valid for
one user's Claude Code plan may not exist on another's, and the same is
true across OpenCode/Cursor/Codex providers. Never assume a specific model
string is or isn't available; always confirm with the user, or point them
at the platform's own model listing/picker as the source of truth (e.g.
Cursor's model dropdown, OpenCode's configured provider list, `claude
config` for Claude Code) instead of guessing.

## Live-invoke testing is only possible from within the same platform

The session running this skill is itself one specific platform. It can
only *actually invoke* a subagent (and see whether it errors) when the
agent being checked belongs to that same platform — e.g. a Claude Code
session can spawn another Claude Code subagent via its Agent/Task tool and
observe the result directly. For an agent file belonging to a different
platform, this skill can only validate the file statically (location,
required frontmatter present) — it cannot prove the agent actually runs
there. In that case, give the user the platform's manual invoke command
and ask them to run it and report back what happened.
