---
type: regex
pattern: 'max_attempts:?\s*2'
match: contains
target:
  source: file
  path: '.eng-team/sweeps/eval-1/sweep.md'
weight: 2
---
The plan caps attempts per item at 2 (escalate, never loop).
