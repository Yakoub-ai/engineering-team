---
type: regex
pattern: 'Last verified against: \S+'
match: contains
target:
  source: file
  path: docs/brief.md
weight: 1
---
docs/brief.md carries a `Last verified against:` line with a value.
