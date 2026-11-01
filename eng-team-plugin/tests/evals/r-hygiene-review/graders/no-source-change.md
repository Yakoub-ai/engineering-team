---
type: regex
pattern: 'function toCurrency'
match: contains
target:
  source: file
  path: 'src/orders.js'
weight: 1
---
Review is report-only: src/orders.js still has toCurrency.
