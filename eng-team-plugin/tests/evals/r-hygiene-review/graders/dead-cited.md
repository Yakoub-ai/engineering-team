---
type: regex
pattern: 'legacyDiscount'
match: contains
target:
  source: file
  path: 'docs/reviews/eng-review.md'
weight: 1
---
legacyDiscount in src/orders.js is reported as unused (PLANTED-H2).
