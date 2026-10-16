---
type: regex
pattern: '^\|\s*A\d+\s*\|.*\|\s*agent\s*\|\s*$'
flags: m
match: contains
target:
  source: file
  path: .eng-team/state.md
weight: 1
---
.eng-team/state.md has at least one Assumptions row (A<n>) whose Source column is `agent`.
