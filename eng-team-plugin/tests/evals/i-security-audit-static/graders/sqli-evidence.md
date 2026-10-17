---
type: regex
pattern: 'src/db\.js[^\n]{0,60}?(?<!\d)6(?!\d)'
match: contains
target:
  source: file
  path: 'docs/security/security-audit.md'
weight: 1
---
The report cites src/db.js line 6 (string-concatenated SQL, PLANTED-5).
