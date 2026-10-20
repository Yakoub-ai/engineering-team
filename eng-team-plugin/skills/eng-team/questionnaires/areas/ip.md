---
id: area-ip
kind: questionnaire
scope: area
status: unreviewed
reviewed_by:
review_by: 2027-04-20
languages: [sv, en]
sources:
  - title: EUR-Lex, Regulation (EU) 2016/679 (GDPR) official text
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    accessed: 2026-10-20
---
# Area: intellectual property (immaterialrätt: varumärke, patent, upphovsrätt, designskydd)

### Q-IP-01
- stage: pre
- priority: 1
- topic: portfolio
- type: number
- sv: Hur många registrerade rättigheter hanterar ni (varumärken, patent, design), och i vilket register eller system förs de?
- en: How many registered rights do you manage (trademarks, patents, designs), and in which register or system are they kept?
- why_sv: Portföljens storlek avgör om ett specialiserat förvaltningsverktyg motiveras.
- why_en: Portfolio size decides whether a specialised management tool is justified.
- fills: workflow.volume

### Q-IP-02
- stage: pre
- priority: 1
- topic: renewals
- type: open
- sv: Hur bevakar ni förnyelser, svarstider hos registreringsmyndigheter och betalningsdatum?
- en: How do you track renewals, response periods at registration authorities and payment dates?
- why_sv: Förlorade rättigheter på grund av missade datum är en direkt och dyr risk.
- why_en: Lost rights from missed dates are a direct and costly risk.
- fills: opportunities.deadlines

### Q-IP-03
- stage: pre
- priority: 2
- topic: search
- type: open
- sv: Hur gör ni sökningar efter tidigare rättigheter eller förväxlingsrisk, och hur dokumenteras resultatet?
- en: How do you search for prior rights or likelihood of confusion, and how is the result documented?
- why_sv: Sökning är arbetsintensiv och kan delvis stödjas av register-API:er och verktyg.
- why_en: Searching is labour-intensive and can be partly supported by register APIs and tools.
- fills: opportunities.search

### Q-IP-04
- stage: meeting
- priority: 2
- topic: monitoring
- type: open
- sv: Övervakar ni intrång eller nya ansökningar åt klienter, och hur sker det?
- en: Do you monitor infringements or new filings for clients, and how?
- why_sv: Övervakning är återkommande och går ofta att köpa som tjänst.
- why_en: Monitoring is recurring and can often be bought as a service.
- fills: opportunities.monitoring

### Q-IP-05
- stage: meeting
- priority: 3
- topic: confidential-inventions
- type: open
- sv: Hur skyddas konfidentiell information som uppfinningar före ansökan i era system och hos leverantörer?
- en: How is confidential information such as inventions before filing protected in your systems and at vendors?
- why_sv: Röjande före ansökan kan förstöra rättigheter, vilket begränsar verktygsval.
- why_en: Disclosure before filing can destroy rights, which limits tool choices.
- fills: constraints.policy
- sensitive: yes

## Guardrails

- Pre-filing inventions and unreleased brand plans are confidential by nature; any cloud or AI tool that retains or trains on inputs must be excluded or contractually restricted. `opinion:` precaution derived from the loss-of-novelty risk. `needs-evidence`: confirm the vendor's retention and training terms in writing.
- Personal data in registers (applicants, inventors) is covered by the GDPR; see `countries/eu.md`.
