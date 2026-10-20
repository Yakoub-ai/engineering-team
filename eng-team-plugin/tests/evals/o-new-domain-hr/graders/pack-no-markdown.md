---
type: regex
pattern: '^\s*\|.*\|\s*$|\*\*'
flags: m
match: not_contains
target:
  source: file
  path: 'docs/engineering/engagement/premeeting-hr-onboarding-en.md'
weight: 1
---
The pack is plain text: no Markdown table rows or bold.
