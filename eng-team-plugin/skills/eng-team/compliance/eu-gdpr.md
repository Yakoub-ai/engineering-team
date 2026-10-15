---
id: eu-gdpr
kind: compliance
status: reviewed
tier: plugin
sources:
  - title: Regulation (EU) 2016/679 (GDPR)
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    accessed: 2026-10-15
  - title: IMY
    url: https://www.imy.se/
    accessed: 2026-10-15
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: NOT profile.data_classes contains "none"
---
# Compliance profile: GDPR (Regulation (EU) 2016/679) + Swedish specifics

Supervisor (SE): IMY. Use alongside the cross-cutting checks in `roles/compliance-officer.md`.

| Article | Obligation | What to look for in code/config | If not visible |
|---|---|---|---|
| 5 | Principles: minimisation, purpose, storage limitation, integrity | Unused personal fields; retention config + deletion jobs | — |
| 6 / 9 / 10 | Lawful basis; special-category (health — common in insurance); criminal-offence data (e.g. fraud) | Special-category fields flagged, extra access control, separate encryption/keys | Basis per purpose → needs-evidence (DPO) |
| 12–21 | Data subject rights: access, rectification, erasure, restriction, portability, objection | Implementable paths per store (see role file); machine-readable export | Response process → needs-evidence |
| 22 | Automated decisions with legal/similar effect | Human-review path, explanation, ability to contest | Assessment → needs-evidence |
| 25 | Privacy by design/default | Defaults most private; pseudonymisation in analytics/dev | — |
| 28 | Processors | Every third party receiving personal data identified | DPA per processor → needs-evidence |
| 30 | Records of processing | — | RoPA entry → needs-evidence |
| 32 | Security of processing | Encryption, access control, logging, backups, testing (links to SEC/PLT findings) | — |
| 33 / 34 | Breach notification (72h to IMY; data subjects if high risk) | Ability to determine *which* subjects/records were affected (audit logs, access logs) | Procedure → needs-evidence |
| 35 | DPIA for high-risk processing | — | DPIA → needs-evidence when: special-category at scale, profiling, systematic monitoring, new tech (LLMs) |
| 44–49 | Third-country transfers | Regions of every processor incl. support/telemetry/LLM | Adequacy/DPF/SCCs + transfer assessment → needs-evidence |

## Swedish specifics
- **Personnummer**: Dataskyddslagen allows processing without consent only when clearly justified (purpose, importance of secure identification). Check it isn't used as a primary key, in URLs, logs, analytics, filenames or emails; mask in UIs.
- Check sector secrecy rules with legal for insurance/financial data (confidentiality obligations beyond GDPR).

## Data lake / analytics pitfalls (flag these explicitly)
- Delta/Iceberg time travel and snapshots keep "deleted" rows until VACUUM/expiry — erasure isn't done until history is purged within the retention window.
- Feature stores, ML training sets and model artefacts can contain personal data — include in erasure and retention scope.
- Logs and error trackers: personal data retention there usually exceeds what's documented.
