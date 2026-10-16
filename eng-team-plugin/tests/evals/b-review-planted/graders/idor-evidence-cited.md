---
type: regex
pattern: 'src/server\.js:1[3-8]'
match: contains
target:
  source: file
  path: 'docs/reviews/eng-review.md'
weight: 1
---
The written review cites src/server.js lines 13-18 (the GET /invoices/:id handler with no ownership check, PLANTED-2) as evidence.
