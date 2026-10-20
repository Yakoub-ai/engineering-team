---
id: area-contracts-corporate
kind: questionnaire
domain: legal
scope: area
status: unreviewed
reviewed_by:
review_by: 2027-04-20
languages: [sv, en]
sources:
  - title: Rättegångsbalk (1942:740), 8 kap. 4 § (advokatens tystnadsplikt)
    url: https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/rattegangsbalk-1942740_sfs-1942-740/
    accessed: 2026-10-20
---
# Area: contracts and corporate law (avtal och bolagsrätt)

Contract drafting, review, negotiation, M&A and due diligence, company law work.

### Q-CON-01
- stage: pre
- priority: 1
- topic: contract-volume
- type: number
- sv: Vilka typer av avtal granskar eller skriver ni oftast, och ungefär hur många per månad?
- en: Which types of contracts do you review or draft most often, and roughly how many per month?
- why_sv: Typ och volym avgör om standardisering, mallar eller verktygsstöd lönar sig.
- why_en: Type and volume decide whether standardisation, templates or tool support pays off.
- fills: workflow.volume

### Q-CON-02
- stage: pre
- priority: 1
- topic: playbook
- type: choice
- options_sv: Skriftlig granskningsmall eller playbook finns; Finns delvis i huvudet på seniora jurister; Varierar från fall till fall; Vet inte
- options_en: A written review checklist or playbook exists; It partly lives in senior lawyers' heads; It varies case by case; Don't know
- sv: Hur ser er standard för granskning ut, till exempel acceptabla klausuler och förhandlingsutrymme?
- en: What does your review standard look like, for example acceptable clauses and negotiation room?
- why_sv: En tydlig playbook är förutsättningen för att stödja granskning med verktyg eller AI på ett säkert sätt.
- why_en: A clear playbook is the precondition for supporting review with tools or AI safely.
- fills: workflow.rules

### Q-CON-03
- stage: pre
- priority: 2
- topic: templates
- type: open
- sv: Hur hanterar ni mallar och klausulbibliotek, och hur vet ni vilken version som gäller?
- en: How do you manage templates and clause libraries, and how do you know which version is current?
- why_sv: Versionsröra är en vanlig källa till fel och ett lågt hängande mål.
- why_en: Version confusion is a common source of errors and a low-hanging target.
- fills: opportunities.templates

### Q-CON-04
- stage: meeting
- priority: 2
- topic: negotiation
- type: open
- sv: Hur hanterar ni förhandlingsrundor, ändringsspårning och sammanställning av motpartens ändringar?
- en: How do you handle negotiation rounds, tracked changes and consolidating the counterparty's changes?
- why_sv: Rundor och versioner är tidskrävande och regelstyrda.
- why_en: Rounds and versions are time-consuming and rule-driven.
- fills: workflow.as-is

### Q-CON-05
- stage: meeting
- priority: 2
- topic: obligations
- type: open
- sv: Hur följer ni upp avtalade förpliktelser, förnyelser och uppsägningstider efter signering?
- en: How do you follow up contractual obligations, renewals and notice periods after signing?
- why_sv: Missade datum är en konkret och mätbar risk.
- why_en: Missed dates are a concrete and measurable risk.
- fills: opportunities.contract-management

### Q-CON-06
- stage: meeting
- priority: 3
- topic: due-diligence
- type: open
- sv: Om ni gör due diligence: hur hanteras datarum, dokumentgenomgång och rapportering, och hur många dokument är typiska?
- en: If you do due diligence: how are data rooms, document review and reporting handled, and how many documents are typical?
- why_sv: Stora dokumentmängder med återkommande frågor passar ofta för verktygsstöd.
- why_en: Large document sets with recurring questions often suit tool support.
- fills: opportunities.document-review

## Guardrails

- Client material in a contract review is covered by the advokat's duty of confidentiality; whether an external tool vendor may process it is a question for the firm's own compliance and the Swedish Bar Association, not for this plugin. Source: Rättegångsbalk 8 kap. 4 § (an advokat must keep silent about what is learned in the practice when god advokatsed requires it). `needs-evidence`: the Bar's guidance on outsourcing and cloud tools was not fetched.
- AI that proposes contract changes: keep a named lawyer as the decision-maker and log what was suggested versus accepted. `opinion:` risk-proportionate practice, not a statutory rule.
