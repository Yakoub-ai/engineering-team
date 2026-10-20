---
type: regex
pattern: '^\s*\|.*\|\s*$|\*\*'
match: not_contains
flags: m
target:
  source: file
  path: docs/engineering/engagement/premeeting-forsvarsteamet-sv.md
weight: 1
---
The pack is plain text: no Markdown table rows and no bold markers.
