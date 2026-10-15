---
id: eu-dora
kind: compliance
status: reviewed
tier: plugin
sources:
  - title: Regulation (EU) 2022/2554 (DORA)
    url: https://eur-lex.europa.eu/eli/reg/2022/2554/oj
    accessed: 2026-10-15
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.regulated.financial_entity == "yes"
---
# Compliance profile: DORA (Regulation (EU) 2022/2554)

Applies from 17 Jan 2025 to financial entities (banks, insurers/reinsurers, investment firms, payment institutions, etc.). Supervisor (SE): Finansinspektionen. For these entities DORA is **lex specialis** over NIS2 for ICT risk and incident reporting.

Key question first: does this system support a **critical or important function**? It raises every requirement below. If unknown → ask; don't assume "no".

## Pillar 1 — ICT risk management (Art. 5–16)
Code/config evidence to look for:
- Asset inventory: system, its data, dependencies and owners identifiable (IaC tags, service catalogue entry).
- Protection: least-privilege access, strong authentication, encryption, network segmentation, secure change management (reviewed, tested, approved deploys — links to PLT).
- Detection: logging and anomaly detection for the system (links to SRE).
- Response & recovery: backup policy, restore tested, RTO/RPO defined, recovery plans tested (Art. 11–12).
- Change management: documented, traceable deploys; emergency change path.
Needs-evidence: ICT risk framework coverage of this system; business impact analysis; last continuity/recovery test.

## Pillar 2 — ICT incident management & reporting (Art. 17–23)
- Incidents classified with DORA criteria (clients affected, duration, data loss, criticality of services, geography, economic impact).
- Reporting timelines for **major** incidents (per RTS/ITS): initial notification within 4h of classification and no later than 24h of awareness; intermediate report within 72h; final report within 1 month. Verify current RTS if in doubt.
- The system must produce the data needed for these reports: timestamps, affected clients/transactions, root cause → audit logs and monitoring must support this.
Needs-evidence: incident classification procedure, who reports to FI.

## Pillar 3 — Digital operational resilience testing (Art. 24–27)
- Vulnerability scanning, dependency scanning, SAST/DAST, scenario-based and performance tests in the pipeline (links to SEC/QA/PLT).
- TLPT (threat-led pen testing) applies to designated entities, at least every 3 years.
Needs-evidence: annual testing programme coverage of this system.

## Pillar 4 — ICT third-party risk (Art. 28–30)
- List every ICT provider the system depends on (cloud, SaaS, APIs, LLM providers, CDN, email).
- Each must be in the entity's **register of information**; contracts need DORA Art. 30 clauses (service levels, location of data, audit rights, termination/exit).
- **Exit strategy**: can you move off this provider? Check for proprietary lock-in without an export path.
- Concentration risk: everything on one provider/region for a critical function → flag.
Needs-evidence: register entry, contract clauses, exit plan.

## Pillar 5 — Information sharing (Art. 45)
Voluntary; not checked from code.

## Severity hints
Critical/important function with no tested recovery, no incident data trail, or an unregistered ICT provider → High/Critical.
