# Security checklist (review-time)

Use this when the security axis needs more depth than the summary in
`SKILL.md`. This is a review-time checklist, not a full pentest guide.

## Input handling

- Every external input (HTTP body/query/params, file upload, webhook
  payload, message-queue message) is validated for shape and type before
  use, not just "truthy".
- Validation happens at the boundary (controller/handler), not deep inside
  business logic where it's easy to skip on a new call path.
- File uploads: extension/MIME checked, size capped, stored outside the web
  root or behind an access check.

## Injection

- SQL/NoSQL: parameterized queries or an ORM's query builder — no string
  concatenation of user input into a query.
- Shell: no user input passed to a shell command without strict allowlist
  validation; prefer an argv-array API over a shell string.
- Template/HTML: output-encoded by default (framework's auto-escaping is
  on); any `dangerouslySetInnerHTML` / `| safe` / raw-HTML path is
  justified and the input is sanitized first.

## AuthN / AuthZ

- Every new endpoint has an explicit auth check — "inherits from the
  router" is not good enough to assume, verify it.
- Authorization checks the *resource owner*, not just "is logged in" (e.g.
  can user A fetch user B's record by changing an ID in the URL — IDOR).
- Role/permission checks happen server-side; a client-side-only check is a
  finding.

## Secrets

- No credentials, API keys, or tokens in code, comments, commit history, or
  logs.
- Secrets come from environment/secret-manager, not checked-in config.
- Error responses and logs don't leak stack traces, internal paths, or
  secrets to the client in production.

## Data trust boundaries

- Data from another service, a third-party API, or a webhook is treated as
  untrusted — validated/typed before use, not passed straight into
  business logic or rendering.
- Deserialization of external data uses a safe method (no arbitrary
  object/code deserialization from untrusted input).

## Dependencies

- New dependency checked for known CVEs (`pnpm audit` / equivalent) and
  maintenance status before approval.
- Dependency upgrades reviewed against their changelog, not merged as a
  blind bump.

## Session / tokens

- Tokens have an expiry; nothing long-lived without a rotation/refresh
  story.
- Session/auth cookies are `HttpOnly`, `Secure`, and scoped appropriately
  (`SameSite`).

## When a finding is Critical vs. Required

- **Critical (blocks merge):** exploitable injection, missing authz on a
  data-mutating or PII-exposing endpoint, secret committed to the repo,
  auth bypass.
- **Required:** missing input validation on a non-exploitable path, a
  dependency with a known but low-severity CVE, logging that includes PII
  without redaction.
