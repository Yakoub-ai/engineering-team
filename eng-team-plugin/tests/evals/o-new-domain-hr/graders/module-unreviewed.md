---
type: regex
pattern: '^status:\s*unreviewed\s*$'
flags: m
match: contains
target:
  source: file
  path: '.eng-team/questionnaires/hr-onboarding.md'
weight: 2
---
The drafted module is marked status: unreviewed.
