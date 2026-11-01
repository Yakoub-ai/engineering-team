---
type: regex
pattern: 'HYG-\d+'
match: contains
target:
  source: file
  path: 'docs/reviews/eng-review.md'
weight: 1
---
The review ran the code-hygiene lane: at least one HYG finding.
