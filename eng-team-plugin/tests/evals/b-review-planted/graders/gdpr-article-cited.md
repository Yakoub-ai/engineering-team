---
type: regex
pattern: 'GDPR Art(icle|\.)?\s*(5|32)'
match: contains
target:
  source: file
  path: 'docs/reviews/eng-review.md'
weight: 1
---
The written review cites GDPR Article 5 and/or Article 32 (the signup log of email, name and IP, PLANTED-3).
