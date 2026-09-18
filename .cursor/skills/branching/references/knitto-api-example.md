# Worked example: knitto-api

A real Node.js/pnpm API repo documents (in its own `README.md`) exactly
this paired-branch model. Kept here as the concrete reference this skill
was generalized from.

## Branches

- `main` — trunk / source of truth for what's in production code-wise.
- `releases/main` — long-lived deploy branch; CI (`.github/workflows/deploy-production.yml`)
  deploys to production on every push to this branch.
- `releases/sandbox` — long-lived deploy branch; CI
  (`.github/workflows/deploy-sandbox.yml`) deploys to a sandbox/staging
  environment on every push.
- `feat/<nama-pb>-main` — per-feature working branch, branched from `main`.
  `<nama-pb>` is the product-backlog identifier/slug (e.g.
  `PB-1.864-fitur-sale-stok-kain-kurang-1kg`).
- `feat/<nama-pb>-dev` — per-feature staging branch, holds cherry-picks
  from the matching `-main` branch.

Other prefixes observed in the same repo following the identical `-main`/
`-dev` pairing: `fix/`, `hotfix/`, `bugfix/`, `refactor/` — the model isn't
limited to `feat/`.

## Documented rules (verbatim intent, translated)

1. Work happens on the `-main` branch (e.g. `feat/namapb-main`).
2. Every commit must follow a fixed message convention, because commits get
   cherry-picked later and need to stay identifiable out of context:
   `` `nama fitur`: pesan commitnya `` — e.g.
   `` `kalkulator bahan`: buat endpoint get list kain ``.
3. To get onto sandbox:
   1. Switch to (or create) the `-dev` companion branch, branched from the
      `-main` branch's head if it doesn't exist yet.
   2. Cherry-pick any commits added to `-main` since the last sync.
   3. Merge the `-dev` branch into `releases/sandbox`.
   4. Open a PR and request review.
4. To reach production:
   1. Testing must be signed off by the tester team first.
   2. Open a PR from `feat/namapb-main` into `main`.

Deploying to production is a separate mechanical step from the `main`
merge: `releases/main` is what CI actually watches, so someone still needs
to get the merged change onto `releases/main` (not documented explicitly in
this repo's README as a distinct step, which is itself a gap worth flagging
if a repo you're working in has the same ambiguity — confirm rather than
assume merging to `main` alone deploys).

## Why the `-dev` cherry-pick indirection exists

`-main` branches accumulate normal, sometimes messy, in-progress commit
history (WIP commits, fixups, iteration). `releases/sandbox` is shared
across every feature currently being tested — if every feature merged its
raw `-main` history directly into it, the shared branch's history would
become unreadable and conflict-prone across unrelated features. The `-dev`
branch acts as a clean, curated cherry-picked subset (in practice: usually
the same commits, but re-picked explicitly and traceable via
`git cherry-pick -x`'s origin trailer) that's safe to layer onto a shared
branch alongside everyone else's.

## Takeaway for applying this model elsewhere

A repo doesn't need to match this naming exactly to be "this model" — the
signal to look for is: (a) a shared long-lived branch that many features
land on before production, and (b) an indirection branch used specifically
to curate what reaches it, rather than merging working branches directly.
If a repo has (a) but not (b) — i.e. features merge directly into a shared
staging branch — that's a different, simpler model; don't invent a `-dev`
indirection layer that repo never asked for.
