# Compliance profile: NIS2 (Directive (EU) 2022/2555)

Sweden: transposed by **Cybersäkerhetslagen (SFS 2025:1506)**, in force 15 Jan 2026; incident reporting obligations applied from that date. Covers medium-sized+ operators in Annex I/II sectors; Swedish law takes a whole-organisation approach. Financial entities under DORA → use `eu-dora.md` instead for overlapping areas.

## Art. 21 risk-management measures → evidence in code/config
| Measure | Look for |
|---|---|
| Risk analysis & security policies | needs-evidence |
| Incident handling | Detection/alerting (SRE), runbooks |
| Business continuity, backups, crisis management | Backups, tested restore, DR (PLT) |
| Supply-chain security | Dependency scanning, vendor list, pinned/verified packages (SEC) |
| Secure acquisition, development and maintenance; vulnerability handling | SDLC gates, patch cadence, disclosure policy |
| Effectiveness assessment | Testing programme — needs-evidence |
| Cyber hygiene and training | needs-evidence |
| Cryptography & encryption | TLS, at-rest encryption, key management |
| HR security, access control, asset management | Access reviews, IAM least privilege, inventory |
| MFA / secured communications | MFA on admin and remote access |

## Incident reporting (Art. 23)
Significant incidents: early warning within 24h, incident notification within 72h, final report within 1 month. National CSIRT: CERT-SE. System must preserve the logs to support this.

## Management accountability
Management bodies approve measures and can be held liable — findings should be phrased so a decision-maker can act.

Needs-evidence: entity classification (essential/important), registration with the supervisor, approved security measures.
