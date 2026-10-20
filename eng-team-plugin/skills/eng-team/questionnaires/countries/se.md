---
id: country-se
kind: questionnaire
domain: any
scope: country
status: unreviewed
reviewed_by:
review_by: 2027-04-20
languages: [sv, en]
sources:
  - title: Rättegångsbalk (1942:740), 8 kap. 4 § and 36 kap. 5 §
    url: https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/rattegangsbalk-1942740_sfs-1942-740/
    accessed: 2026-10-20
  - title: Offentlighets- och sekretesslag (2009:400), 1 kap. 1 §
    url: https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/offentlighets--och-sekretesslag-2009400_sfs-2009-400/
    accessed: 2026-10-20
  - title: Brottsdatalag (2018:1177), 1 kap. 1 §
    url: https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/brottsdatalag-20181177_sfs-2018-1177/
    accessed: 2026-10-20
  - title: Lag (2018:218) med kompletterande bestämmelser till EU:s dataskyddsförordning, 3 kap. 8 §
    url: https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018218-med-kompletterande-bestammelser-till_sfs-2018-218/
    accessed: 2026-10-20
  - title: IMY, Swedish Authority for Privacy Protection
    url: https://www.imy.se/en/
    accessed: 2026-10-20
---
# Country module: Sweden

Adds to `countries/eu.md`. Default country and default language (Swedish) for this plugin's engagement work. To add a country, copy this file to `countries/<code>.md`, set `id: country-<code>`, replace the guardrails and sources, and add its legal terms to the area modules where they differ.

## Guardrails

- G-SE-1. Attorney confidentiality: an advokat must carry out assignments diligently, follow god advokatsed and keep silent about what is learned in the practice when god advokatsed requires it (RB 8 kap. 4 §). Advokater also cannot be heard as witnesses about what is entrusted to them in the practice (RB 36 kap. 5 §). Stop: no recommendation that sends client material to a third party until the firm has confirmed in writing that the arrangement preserves confidentiality. `needs-evidence`: the Swedish Bar Association's guidance on outsourcing and cloud services was not fetched.
- G-SE-2. Public sector: the Public Access to Information and Secrecy Act governs authorities' handling of public documents and confidentiality (OSL 1 kap. 1 §). Stop: no tool for an authority without a check against its secrecy, registry and procurement rules.
- G-SE-3. Offence data: the Data Protection Act lets authorities process Article 10 data (3 kap. 8 §) and others only in narrow cases, with further permissions possible by regulation under 3 kap. 9 §. The Criminal Data Act covers competent authorities' processing under Directive (EU) 2016/680 (1 kap. 1 §). Stop: no tool for criminal-case material at a non-authority until the legal basis is documented. `needs-evidence`: the current regulations under 3 kap. 9 § were not verified.
- G-SE-4. Hosting: where a client or authority requires hosting in Sweden or the EU, treat it as a hard constraint in vendor selection. `opinion:` the requirement itself comes from the client's contract or procurement rules.
- G-SE-5. Language: client-facing material is Swedish first; produce an English version when asked. Keep legal terms in Swedish with an English gloss in the report glossary.

## Questions to add to the meeting guide

- Does the Swedish Bar Association, the client or a procurement rule restrict outsourcing and cloud tools for this team, and in what document?
- Does the team handle any material that is subject to secrecy under OSL, or personal data about offences?
