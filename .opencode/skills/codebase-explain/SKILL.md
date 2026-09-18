---
name: codebase-explain
description: Explain a repo, a feature, or how something works in plain, non-technical language, grounded in the actual code (not assumption), and write it out as a markdown file the reader can keep/share — not just a chat answer. Use when a non-developer (PM, stakeholder, new hire, support) needs to understand a codebase or a specific flow, or when the user asks to "explain this repo/feature in simple terms" and wants a document out of it. Not for API/developer-facing reference docs (those need precision and technical vocabulary, the opposite goal of this skill) and not for CLAUDE.md/AGENTS.md (that's agent-facing operational instructions, see project-bootstrap — this is human-facing comprehension).
license: MIT
metadata:
  category: documentation
  author: lintang
compatible_with: [claude-code, opencode, antigravity, commandcode]
---

# Codebase Explain

Turns "read the code and explain it to me like I'm not a developer" into
an actual markdown file, not just a chat response that scrolls away.
Grounded in code that was actually read for this — a plausible-sounding
explanation that wasn't checked against the real implementation is worse
than no explanation, because it reads as authoritative.

## When to use

- A non-developer (PM, stakeholder, support person, new hire) needs to
  understand what a repo or a specific feature does.
- The user asks to "explain this repo/feature in simple terms" and wants
  something written down, not just a spoken-in-chat answer.
- Onboarding someone non-technical who'll be working alongside the
  engineering team and needs the mental model without needing to read
  code.

## When NOT to use

- Developer/API reference documentation — that needs precision and
  technical terms exactly, which is the opposite goal of this skill's
  plain-language approach.
- `CLAUDE.md`/`AGENTS.md` — those are operational instructions *for an
  agent*, not comprehension docs for a human; see `project-bootstrap` for
  that instead.
- Architecture Decision Records or other docs meant for engineers who
  already know the codebase — this skill's whole point is removing the
  need for that background knowledge.

## Steps

1. **Clarify scope and audience before reading anything** — a whole-repo
   overview and a single-feature walkthrough produce very different
   documents, and "explain to a PM" vs "explain to a brand-new junior
   engineer" calibrate differently (how much jargon can stay, how much
   detail on the *how* vs just the *what*). Ask if it isn't already clear
   from the request; don't default to over-explaining or under-explaining.

2. **Read the actual code before writing anything.** Every claim in the
   output must trace back to something actually read — entry points, the
   main flow, key files — not to what a project *typically* looks like.
   If something is genuinely unclear from the code (e.g. business logic
   that only makes sense with domain context not in the repo), say so in
   the output rather than guessing confidently.

3. **Write in plain language, but don't dumb down what's actually true.**
   No unexplained jargon, no assuming the reader knows what a "queue" or
   an "API" is — but also don't oversimplify to the point of being
   inaccurate. When a technical term is genuinely necessary, use it and
   define it once, rather than avoiding it awkwardly.

4. **Use `assets/explain-template.md` as the skeleton** — plain-language
   title, one-paragraph summary, a walkthrough of how it actually works
   (referencing real file/function names so a developer reading the same
   doc can jump to the code), repo layout (for whole-repo scope only),
   and a short terms list (only for terms actually used above — don't pad
   it with a generic glossary). Delete sections that don't apply to the
   scope from step 1 rather than leaving them empty.

5. **An analogy earns its place only if it adds real clarity** — skip it
   if it doesn't, don't force one into every section.

6. **Ask where to save it before writing the file.** Suggest a sensible
   location (e.g. `docs/explained/<topic>.md`) but confirm with the user —
   this is a new file in their repo, don't create it silently.

7. **Note the "as of" date in the output** (the template has a line for
   this) and mention to the user that this is a snapshot — if the code
   changes meaningfully, the right move is regenerating the doc from
   current code, not hand-patching a stale one.

## Reference

- `assets/explain-template.md` — the markdown skeleton every output
  follows; delete sections that don't apply rather than leaving them
  empty.
