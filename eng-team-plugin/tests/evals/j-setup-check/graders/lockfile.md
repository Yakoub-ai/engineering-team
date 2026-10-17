---
type: regex
pattern: 'lock\s*file|package-lock'
flags: i
match: contains
target: last_message
weight: 1
---
Reports the missing lockfile.
