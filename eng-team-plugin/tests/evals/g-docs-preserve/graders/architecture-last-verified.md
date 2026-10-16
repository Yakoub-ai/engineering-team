---
type: regex
pattern: '^Audience:.*\n+Last verified against: \S+'
flags: m
match: contains
target:
  source: file
  path: docs/architecture.md
weight: 1
---
docs/architecture.md starts with an `Audience:` line followed by `Last verified against: <commit>`.
