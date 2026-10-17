---
type: regex
pattern: '\.env\.example'
match: contains
target: last_message
weight: 1
---
Reports the missing .env.example.
