---
type: regex
pattern: 'reviewed-manually|not-run'
flags: i
match: contains
target:
  source: file
  path: 'docs/security/security-audit.md'
weight: 1
---
Coverage marks layers without a tool as reviewed-manually or not-run instead of scanned.
