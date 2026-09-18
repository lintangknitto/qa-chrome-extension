# Performance checklist (review-time)

Use this when the performance axis needs more depth than the summary in
`SKILL.md`. Goal is to catch *review-visible* performance problems — not to
replace real profiling.

## Database / query layer

- No N+1: a loop that issues one query per iteration instead of a single
  batched/joined query. Look for a query call inside a `.map`/`.forEach`/
  `for` over a collection that came from another query.
- List endpoints have pagination (limit/offset or cursor) — an unbounded
  `SELECT *` on a table that grows with usage is a finding even if it's
  fine today.
- New query has an index backing its filter/sort columns, or an explicit
  note that it's low-cardinality/low-volume enough not to need one.
- No `SELECT *` pulling unused columns on a hot path (matters more for wide
  tables / large blobs).

## Application code

- No synchronous/blocking I/O on a request path that should be async
  (blocking file read, synchronous HTTP call inside a request handler).
- No large object constructed or large array copied inside a loop that
  runs per-request or per-item.
- Caching used for genuinely expensive, repeat-fetched, slow-changing data
  — and the cache has an invalidation story (don't flag "no cache" as a
  problem by itself; flag caching *without* an invalidation/TTL story).

## Frontend-specific

- No unnecessary re-renders introduced (missing memoization on a component
  that re-renders on every parent update with unchanged props, inline
  object/array literals passed as props to a memoized child).
- Large lists render virtualized/paginated, not the full set at once.
- No large synchronous computation on the main thread inside a render path.

## Network / payload

- Response payload doesn't include more than the client needs (a full
  entity when the UI shows three fields, N+1 nested includes that could be
  a separate lazy-loaded call).
- New third-party script/asset doesn't materially grow bundle size without
  a justification (check the framework's bundle-analysis output if
  available).

## Severity guide

- **Required, not Critical, by default:** most performance findings are
  Required (must fix before merge) rather than Critical, unless the change
  is on a path already known to be a bottleneck (checkout, auth, a
  dashboard's primary list) or the regression is large enough to be
  user-visible (multi-second load, timeout risk).
- **Quantify when you can:** "this adds one query per row, ~N ms extra at
  current data volume" is a stronger finding than "this could be slow" —
  makes the required fix undeniable and gives the author a target.
