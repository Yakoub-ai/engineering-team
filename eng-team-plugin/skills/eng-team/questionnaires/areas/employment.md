---
id: area-employment
kind: questionnaire
scope: area
status: unreviewed
reviewed_by:
review_by: 2027-04-20
languages: [sv, en]
sources:
  - title: Regulation (EU) 2016/679 (GDPR), Article 88 (processing in the employment context)
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    accessed: 2026-10-20
---
# Area: employment and labour law (arbetsrätt)

### Q-EMP-01
- stage: pre
- priority: 1
- topic: matter-types
- type: list
- sv: Vilka typer av arbetsrättsliga ärenden är vanligast, till exempel uppsägning, omplacering, tvisteförhandling, avtal eller rådgivning, och hur många per månad?
- en: Which types of employment matters are most common, for example dismissal, reassignment, dispute negotiation, agreements or advice, and how many per month?
- why_sv: Ärendemix och volym visar var mallar och checklistor ger mest.
- why_en: Matter mix and volume show where templates and checklists give the most.
- fills: workflow.volume

### Q-EMP-02
- stage: pre
- priority: 1
- topic: deadlines
- type: open
- sv: Vilka frister och formkrav måste bevakas, och hur bevakar ni dem idag?
- en: Which deadlines and formal requirements must be tracked, and how do you track them today?
- why_sv: Frister i arbetsrätt är korta och missar är kostsamma.
- why_en: Employment-law deadlines are short and misses are costly.
- fills: opportunities.deadlines

### Q-EMP-03
- stage: pre
- priority: 2
- topic: templates
- type: open
- sv: Hur hanterar ni anställningsavtal, avtal vid avslut och policyer som mallar, och hur ofta behöver de anpassas?
- en: How do you handle employment contracts, termination agreements and policies as templates, and how often must they be adapted?
- why_sv: Anpassningsgrad avgör om dokumentgenerering lönar sig.
- why_en: Degree of adaptation decides whether document generation pays off.
- fills: opportunities.templates

### Q-EMP-04
- stage: meeting
- priority: 2
- topic: negotiations
- type: open
- sv: Hur förbereds och dokumenteras förhandlingar med fackliga organisationer, och hur sparas protokoll och överenskommelser?
- en: How are negotiations with trade unions prepared and documented, and how are minutes and agreements stored?
- why_sv: Dokumentation och spårbarhet är återkommande moment med tydliga regler.
- why_en: Documentation and traceability are recurring steps with clear rules.
- fills: workflow.as-is

### Q-EMP-05
- stage: meeting
- priority: 2
- topic: employee-data
- type: open
- sv: Vilka personuppgifter om anställda ingår i ärendena, och vilka krav ställer klienter på hanteringen?
- en: What personal data about employees is part of the matters, and what do clients require of its handling?
- why_sv: Personuppgifter om anställda begränsar verktygs- och leverantörsval.
- why_en: Employee personal data limits tool and vendor choices.
- fills: constraints.policy
- sensitive: yes

## Guardrails

- Member States may set specific rules for processing employees' personal data; check the national rules before choosing a tool that stores such data. Source: GDPR Article 88. `needs-evidence`: the Swedish provisions were not reviewed here.
- Automated assessment of individual employees (for example ranking for redundancy) must keep a human decision-maker. `opinion:` precaution; GDPR Article 22 on automated individual decisions also applies (`countries/eu.md`).
