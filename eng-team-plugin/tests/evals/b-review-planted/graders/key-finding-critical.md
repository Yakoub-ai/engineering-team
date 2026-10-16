---
type: regex
pattern: '\[Critical\][^\n]*([Kk]ey|[Ss]ecret|[Cc]redential)'
match: contains
target:
  source: file
  path: docs/reviews/eng-review.md
weight: 1
---
The written review lists the hard-coded Stripe key (PLANTED-1) as a Critical finding.
