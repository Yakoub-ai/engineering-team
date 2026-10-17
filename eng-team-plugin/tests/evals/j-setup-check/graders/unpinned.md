---
type: regex
pattern: 'checkout@main|node:latest|"\*"|wildcard'
flags: i
match: contains
target: last_message
weight: 1
---
Reports an unpinned version (actions/checkout@main, node:latest or express "*").
