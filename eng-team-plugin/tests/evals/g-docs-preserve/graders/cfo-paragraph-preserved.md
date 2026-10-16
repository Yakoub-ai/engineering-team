---
type: regex
pattern: 'NOTE FROM CFO: budget is capped at 40k EUR\.'
match: contains
target:
  source: file
  path: docs/brief.md
weight: 1
---
The human-written CFO paragraph is still present verbatim in docs/brief.md.
