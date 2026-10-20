---
type: regex
pattern: 'Outcome:[\s\S]*Owner[\s\S]*(First step|Next step)[\s\S]*Review'
match: contains
flags: i
target:
  source: file
  path: docs/engineering/engagement/recommendation.md
weight: 1
---
The recommendation states an outcome, owner, first step and review date.
