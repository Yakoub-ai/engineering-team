---
type: regex
pattern: 'standards-unavailable'
match: contains
target:
  source: file
  path: .eng-team/state.md
weight: 1
---
.eng-team/state.md records a `standards-unavailable` entry.
