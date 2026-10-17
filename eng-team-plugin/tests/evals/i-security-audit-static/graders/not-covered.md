---
type: regex
pattern: '^#{1,4}\s*Not covered'
flags: m
match: contains
target:
  source: file
  path: 'docs/security/security-audit.md'
weight: 1
---
The report has a Not covered section.
