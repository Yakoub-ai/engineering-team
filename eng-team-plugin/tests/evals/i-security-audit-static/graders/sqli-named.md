---
type: regex
pattern: '(sql\s*injection|CWE-89)'
flags: i
match: contains
target:
  source: file
  path: 'docs/security/security-audit.md'
weight: 1
---
The report names SQL injection or CWE-89.
