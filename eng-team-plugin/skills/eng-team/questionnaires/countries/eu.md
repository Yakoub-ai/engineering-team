---
id: country-eu
kind: questionnaire
domain: any
scope: country
status: unreviewed
reviewed_by:
review_by: 2027-04-20
languages: [sv, en]
sources:
  - title: Regulation (EU) 2016/679 (GDPR) official text
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    accessed: 2026-10-20
  - title: Regulation (EU) 2024/1689 (AI Act) official text
    url: https://eur-lex.europa.eu/eli/reg/2024/1689/oj
    accessed: 2026-10-20
  - title: AI Act, Annex III (mirror used to read point 8)
    url: https://artificialintelligenceact.eu/annex/3/
    accessed: 2026-10-20
---
# Country baseline: EU

Applies to every engagement in an EU Member State, in any domain. Apply a guardrail only when its condition matches the team's data and decisions. A national module (for example `countries/se.md`) adds to it. Country modules hold no questions; they hold the guardrails that limit which options `challenger/solution-fit.md` may recommend, and they list questions to add to the meeting guide.

## Guardrails

- G-EU-1. Criminal-offence data: GDPR Article 10 allows processing only under official authority or where Union or Member State law authorises it with safeguards. Stop: no tool recommendation for criminal-case material without a documented legal basis.
- G-EU-2. Processors and transfers: a vendor that processes personal data is a processor and needs an Article 28 agreement; transfers outside the EEA need a Chapter V basis. Stop: no vendor recommendation without both documented.
- G-EU-3. Automated decisions: individuals have rights against decisions based solely on automated processing with legal or similarly significant effects (GDPR Article 22). Stop: no design that removes the human decision-maker from decisions about people.
- G-EU-4. AI Act, administration of justice: Annex III point 8(a) lists as high-risk AI systems intended to be used by or on behalf of a judicial authority to assist in researching and interpreting facts and the law and applying the law to facts, or used similarly in alternative dispute resolution. Flag: any solution for courts, judges or dispute resolution needs a high-risk classification check before it is proposed. A law firm's own research or drafting tool is a different use; the classification is a legal question.
- G-EU-5. AI Act, employment: Annex III point 4 lists as high-risk AI systems intended for recruitment or selection (targeting job ads, filtering applications, evaluating candidates) and for decisions on terms of work, promotion or termination, task allocation based on behaviour or traits, and monitoring and evaluating performance. Flag: any HR or workforce tool that ranks, scores or monitors people needs a high-risk classification check.
- G-EU-6. AI Act, essential services: Annex III point 5 lists AI used by or for public authorities to evaluate eligibility for essential public benefits and services, to evaluate creditworthiness or credit scores (except fraud detection), and for risk assessment and pricing in life and health insurance. Flag: finance, insurance and public-benefit tools that score people need the same check.
- G-EU-7. Sector rules: health, finance, public-sector and other regulated domains carry rules beyond the GDPR (for example health-data secrecy, financial supervision). `needs-evidence`: the formulating agent must name the domain's rules with sources or label them needs-evidence; they are not covered by the shipped modules.
- G-EU-8. `needs-evidence`: AI Act application dates and any amendments in force on the engagement date were not verified; check the official text and the Commission's current guidance before quoting a date.

## Questions to add to the meeting guide

- Which of the above applies to this team's data and decisions (offence data, personal data, decisions about people, court or ADR use)?
