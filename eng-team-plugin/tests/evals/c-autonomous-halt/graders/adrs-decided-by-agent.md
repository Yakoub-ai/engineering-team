---
type: regex
pattern: 'Decided by:\s*<name>'
match: not_contains
target: trace
weight: 1
---
No ADR the agent wrote keeps the unfilled template placeholder: every saved ADR has its `Decided by:` line filled (`agent` in autonomous mode). Passes if no ADRs were written.
