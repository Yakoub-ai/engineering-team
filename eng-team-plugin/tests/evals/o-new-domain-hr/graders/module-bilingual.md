---
type: regex
pattern: '^- sv: .+[\s\S]*^- en: .+[\s\S]*^- why_sv: .+[\s\S]*^- why_en: .+'
flags: m
match: contains
target:
  source: file
  path: '.eng-team/questionnaires/hr-onboarding.md'
weight: 1
---
Questions have Swedish and English text and why lines.
