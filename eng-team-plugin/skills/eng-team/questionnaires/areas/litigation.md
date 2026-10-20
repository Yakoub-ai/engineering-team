---
id: area-litigation
kind: questionnaire
scope: area
status: unreviewed
reviewed_by:
review_by: 2027-04-20
languages: [sv, en]
sources:
  - title: Rättegångsbalk (1942:740), 36 kap. 5 § (advokaters vittnesbefrielse)
    url: https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/rattegangsbalk-1942740_sfs-1942-740/
    accessed: 2026-10-20
---
# Area: dispute resolution and litigation (tvistemål, processföring, skiljeförfarande)

### Q-LIT-01
- stage: pre
- priority: 1
- topic: case-materials
- type: number
- sv: Hur stora dokumentmängder hanterar ni i ett typiskt mål (antal dokument, sidor, bilagor), och hur sorterar ni dem?
- en: How large are the document sets in a typical case (number of documents, pages, exhibits), and how do you organise them?
- why_sv: Dokumentmängd och sortering avgör om sökning och sammanfattningsstöd ger nytta.
- why_en: Document volume and organisation decide whether search and summarisation support pays off.
- fills: workflow.volume

### Q-LIT-02
- stage: pre
- priority: 1
- topic: deadlines
- type: open
- sv: Hur bevakar ni tidsfrister som svarstider, överklagandefrister och preskription, och har något missats eller varit nära att missas?
- en: How do you track deadlines such as response periods, appeal periods and limitation periods, and has anything been missed or nearly missed?
- why_sv: Fristbevakning är en hög risk som ofta kan förbättras med enkla verktyg.
- why_en: Deadline tracking is a high risk that can often be improved with simple tools.
- fills: opportunities.deadlines

### Q-LIT-03
- stage: pre
- priority: 2
- topic: chronology
- type: open
- sv: Hur bygger ni upp kronologi, faktaunderlag och bevisning under ett mål?
- en: How do you build chronologies, fact bases and evidence during a case?
- why_sv: Kronologier tar mycket tid och är regelstyrda att skapa från källmaterial.
- why_en: Chronologies take a lot of time and are rule-driven to build from source material.
- fills: opportunities.chronology

### Q-LIT-04
- stage: meeting
- priority: 2
- topic: filings
- type: open
- sv: Hur lämnar ni in handlingar till domstol och tar emot handlingar tillbaka, och hur ser stämningsansöknings- och skriftväxlingsmallar ut?
- en: How do you file documents with the court and receive them back, and what do your pleading and exchange-of-writs templates look like?
- why_sv: Insändning och mallar är vanligtvis standardiserbara moment.
- why_en: Filing and templates are usually standardisable steps.
- fills: workflow.as-is

### Q-LIT-05
- stage: meeting
- priority: 3
- topic: cost-estimates
- type: open
- sv: Hur räknar ni ut och följer upp kostnadsberäkningar och ersättningsyrkanden?
- en: How do you calculate and follow up cost estimates and cost claims?
- why_sv: Kostnadsunderlag återkommer i varje mål och bygger på tidsregistrering.
- why_en: Cost bases recur in every case and build on time records.
- fills: opportunities.billing

## Guardrails

- Material in an ongoing dispute includes information protected for advokater as witnesses (RB 36 kap. 5 §); any tool that stores or processes it must keep that protection intact. `needs-evidence`: whether a given vendor arrangement preserves the protection is a legal question for the firm.
- Tools that summarise or rank evidence must show their sources so a lawyer can verify each point. `opinion:` standard practice to limit fabricated-fact risk.
