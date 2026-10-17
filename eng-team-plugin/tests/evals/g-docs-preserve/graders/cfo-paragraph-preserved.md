---
type: regex
pattern: 'NOTE FROM CFO: budget is capped at 40k EUR\.'
match: contains
target:
  source: file
  path: docs/engineering/product/brief.md
weight: 1
---
The human-written CFO paragraph is still present verbatim in docs/engineering/product/brief.md.
