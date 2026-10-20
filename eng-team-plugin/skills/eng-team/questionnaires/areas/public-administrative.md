---
id: area-public-administrative
kind: questionnaire
scope: area
status: unreviewed
reviewed_by:
review_by: 2027-04-20
languages: [sv, en]
sources:
  - title: Offentlighets- och sekretesslag (2009:400), 1 kap. 1 §
    url: https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/offentlighets--och-sekretesslag-2009400_sfs-2009-400/
    accessed: 2026-10-20
---
# Area: public and administrative law (förvaltningsrätt, statlig och kommunal rätt)

Authority legal units, counsel to the state or municipalities, and firms acting before administrative courts.

### Q-ADM-01
- stage: pre
- priority: 1
- topic: case-types
- type: list
- sv: Vilka ärendetyper hanterar ni mest, till exempel överklaganden, tillsyn, myndighetsutövning, remisser eller lagstiftningsarbete, och hur många per månad?
- en: Which case types do you handle most, for example appeals, supervision, exercise of public authority, consultation responses or legislative work, and how many per month?
- why_sv: Ärendetyp avgör vilka delar som är regelstyrda nog att stödja.
- why_en: Case type decides which parts are rule-based enough to support.
- fills: workflow.volume

### Q-ADM-02
- stage: pre
- priority: 1
- topic: legal-sources
- type: open
- sv: Hur söker ni och håller koll på författningar, förarbeten, praxis och vägledande beslut, och hur uppdaterar ni underlag när regler ändras?
- en: How do you search and keep track of statutes, preparatory works, case law and guiding decisions, and how do you update material when rules change?
- why_sv: Rättskällearbete är återkommande och går att stödja, men källan måste alltid kunna verifieras.
- why_en: Legal-source work is recurring and can be supported, but the source must always be verifiable.
- fills: opportunities.knowledge

### Q-ADM-03
- stage: pre
- priority: 2
- topic: decision-templates
- type: open
- sv: Hur utformas beslut och motiveringar, finns mallar eller beslutsstöd, och hur säkerställs enhetlig tillämpning mellan handläggare?
- en: How are decisions and reasons drafted, are there templates or decision support, and how is consistent application between case officers ensured?
- why_sv: Enhetlighet och motiveringskrav styr vad automatiserat stöd får göra.
- why_en: Consistency and reasoning requirements steer what automated support may do.
- fills: workflow.rules

### Q-ADM-04
- stage: meeting
- priority: 2
- topic: appeals
- type: open
- sv: Hur hanteras överklaganden och yttranden till domstol, och hur stor andel av arbetet är återkommande textarbete?
- en: How are appeals and statements to the court handled, and how much of the work is recurring text?
- why_sv: Återkommande text med fast struktur är en tydlig kandidat för mallstöd.
- why_en: Recurring text with fixed structure is a clear candidate for template support.
- fills: opportunities.templates

### Q-ADM-05
- stage: meeting
- priority: 2
- topic: public-records
- type: open
- sv: Hur påverkar offentlighetsprincipen och sekretess vilka system, molntjänster och leverantörer ni får använda?
- en: How do the principle of public access and confidentiality affect which systems, cloud services and vendors you may use?
- why_sv: Myndigheters hantering av allmänna handlingar sätter hårda ramar för verktygsval.
- why_en: Authorities' handling of public documents sets hard limits on tool choice.
- fills: constraints.policy
- sensitive: yes

## Guardrails

- The Public Access to Information and Secrecy Act governs authorities' registration, release and handling of public documents and the duty of confidentiality in public activity; any tool touching those documents must respect it. Source: OSL (2009:400) 1 kap. 1 §.
- Support for decisions that affect individuals must keep a named human case officer as the decision-maker and keep the reasons traceable. `opinion:` design principle. `needs-evidence`: check the authority's own rules and the AI Act classification for the specific use (`countries/eu.md`).
