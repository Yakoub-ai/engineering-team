---
type: regex
pattern: '\[(Critical|High)\][^\n]*HYG-'
match: not_contains
target:
  source: file
  path: 'docs/reviews/eng-review.md'
weight: 1
---
No HYG finding is above Medium.
