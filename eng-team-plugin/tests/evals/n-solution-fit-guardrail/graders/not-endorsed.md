---
type: regex
pattern: 'assist only|do not automate|not recommended'
match: contains
flags: i
target:
  source: file
  path: docs/engineering/engagement/recommendation.md
weight: 2
---
The outcome is assist only, do not automate or not recommended, not buy or build.
