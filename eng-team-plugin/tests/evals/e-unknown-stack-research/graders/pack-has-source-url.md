---
type: regex
pattern: 'url:\s*https?://\S+|^\s*-\s*https?://\S+|\]\(https?://[^)\s]+\)'
flags: m
match: contains
target:
  source: file
  path: '.eng-team/packs/sap-btp.md'
weight: 1
---
The new pack lists at least one source URL.
