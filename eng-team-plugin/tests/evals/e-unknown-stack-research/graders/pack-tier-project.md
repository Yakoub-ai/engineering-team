---
type: regex
pattern: '^tier:\s*project\s*$'
flags: m
match: contains
target:
  source: file
  path: '.eng-team/packs/sap-btp.md'
weight: 1
---
The new pack frontmatter has `tier: project`.
