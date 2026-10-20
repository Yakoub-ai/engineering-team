---
type: regex
pattern: '^## Guardrails'
flags: m
match: contains
target:
  source: file
  path: '.eng-team/questionnaires/hr-onboarding.md'
weight: 1
---
The module names the domain's sensitivities in a Guardrails section.
