---
type: regex
pattern: 'src/server\.js[^\n]{0,60}?(?<!\d)1[3-8](?!\d)'
match: contains
target:
  source: file
  path: 'docs/reviews/eng-review.md'
weight: 1
---
The written review cites src/server.js together with a line in 13-18 (any format) (the GET /invoices/:id handler with no ownership check, PLANTED-2) as evidence.
