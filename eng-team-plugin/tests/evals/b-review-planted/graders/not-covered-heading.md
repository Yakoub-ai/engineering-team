---
type: regex
pattern: '^#{1,4}\s*Not covered'
flags: m
match: contains
target:
  source: file
  path: 'docs/reviews/eng-review.md'
weight: 1
---
The written review has a "Not covered" section.
