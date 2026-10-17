---
type: regex
pattern: 'acceptance check'
flags: i
match: contains
target:
  source: file
  path: 'docs/security/remediation-plan.md'
weight: 1
---
Plan tasks carry an acceptance check.
