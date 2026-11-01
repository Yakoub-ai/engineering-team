---
type: regex
pattern: 'toCurrency.{0,600}formatMoney|formatMoney.{0,600}toCurrency'
flags: s
match: contains
target:
  source: file
  path: 'docs/reviews/eng-review.md'
weight: 1
---
toCurrency in src/orders.js is reported as a duplicate of formatMoney in src/money.js (PLANTED-H1).
