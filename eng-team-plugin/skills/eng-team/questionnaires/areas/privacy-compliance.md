---
id: area-privacy-compliance
kind: questionnaire
scope: area
status: unreviewed
reviewed_by:
review_by: 2027-04-20
languages: [sv, en]
sources:
  - title: Regulation (EU) 2016/679 (GDPR) official text
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    accessed: 2026-10-20
  - title: IMY, Swedish Authority for Privacy Protection
    url: https://www.imy.se/en/
    accessed: 2026-10-20
---
# Area: data protection and compliance (dataskydd, regelefterlevnad)

### Q-PRI-01
- stage: pre
- priority: 1
- topic: registers
- type: open
- sv: Hur för ni förteckning över behandlingar, konsekvensbedömningar och personuppgiftsbiträdesavtal, och i vilket verktyg?
- en: How do you keep records of processing, impact assessments and processor agreements, and in which tool?
- why_sv: Dokumentationskrav är återkommande och går att strukturera i verktyg.
- why_en: Documentation requirements are recurring and can be structured in tools.
- fills: workflow.as-is

### Q-PRI-02
- stage: pre
- priority: 1
- topic: requests
- type: number
- sv: Hur många begäranden från registrerade (till exempel registerutdrag eller radering) får ni per månad, och hur hanteras de?
- en: How many requests from data subjects (for example access or erasure) do you receive per month, and how are they handled?
- why_sv: Volym och manuellt arbete avgör om processtöd lönar sig.
- why_en: Volume and manual effort decide whether process support pays off.
- fills: workflow.volume

### Q-PRI-03
- stage: pre
- priority: 2
- topic: incidents
- type: open
- sv: Hur går en personuppgiftsincident till från upptäckt till anmälan, och hur övas processen?
- en: How does a personal data breach flow from detection to notification, and how is the process rehearsed?
- why_sv: Anmälningsfrister är korta, så en tydlig process minskar risk.
- why_en: Notification deadlines are short, so a clear process reduces risk.
- fills: opportunities.incident-process

### Q-PRI-04
- stage: meeting
- priority: 2
- topic: vendor-review
- type: open
- sv: Hur granskas nya leverantörer med avseende på personuppgifter, och hur lång tid tar det?
- en: How are new vendors reviewed for personal data, and how long does it take?
- why_sv: Leverantörsgranskning återkommer och kan standardiseras med checklistor.
- why_en: Vendor review recurs and can be standardised with checklists.
- fills: opportunities.vendor-review

### Q-PRI-05
- stage: meeting
- priority: 3
- topic: regulatory-watch
- type: open
- sv: Hur följer ni förändringar i regelverk och tillsynsbeslut, och vem informeras?
- en: How do you follow changes in regulation and supervisory decisions, and who is informed?
- why_sv: Bevakning är regelstyrd och kan delvis automatiseras med källor som alltid anges.
- why_en: Watching is rule-driven and can be partly automated with sources always shown.
- fills: opportunities.knowledge

## Guardrails

- Cross-border transfers, processors and security of processing are governed by the GDPR (Chapter V, Article 28, Article 32). Any tool vendor handling personal data needs a processor agreement and a documented transfer basis. Source: GDPR official text.
- The Swedish supervisory authority is IMY; its published guidance should be consulted before relying on a vendor for sensitive categories. Source: IMY website. `needs-evidence`: specific guidance documents were not fetched.
