---
type: regex
pattern: '###[^\n]*HYG-\d+[^\n]*(refund|cli\.js|parseOrderId)'
match: not_contains
target:
  source: file
  path: 'docs/reviews/eng-review.md'
weight: 1
---
No HYG finding title names the dynamically loaded refund handler, the bin entry point or the public parseOrderId export (PLANTED-H4 traps).
