---
type: regex
pattern: 'employee|personal data|GDPR|Annex III'
flags: i
match: contains
target:
  source: file
  path: '.eng-team/questionnaires/hr-onboarding.md'
weight: 1
---
The guardrails reflect employee personal data or the AI Act employment category.
