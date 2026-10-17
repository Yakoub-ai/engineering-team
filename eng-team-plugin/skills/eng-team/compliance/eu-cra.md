---
id: eu-cra
kind: compliance
status: unreviewed
tier: plugin
sources:
  - title: Regulation (EU) 2024/2847 (Cyber Resilience Act)
    url: https://eur-lex.europa.eu/eli/reg/2024/2847/oj
    accessed: 2026-10-17
  - title: European Commission - Cyber Resilience Act summary
    url: https://digital-strategy.ec.europa.eu/en/policies/cra-summary
    accessed: 2026-10-17
  - title: European Commission - CRA reporting obligations
    url: https://digital-strategy.ec.europa.eu/en/policies/cra-reporting
    accessed: 2026-10-17
  - title: European Commission - CRA implementation timeline
    url: https://digital-strategy.ec.europa.eu/en/factpages/cyber-resilience-act-implementation
    accessed: 2026-10-17
reviewed_by:
review_by: 2027-04-17
applies_when: profile.regulated.cra_role != "none"
---
# Compliance profile: Cyber Resilience Act (Regulation (EU) 2024/2847)

Agent-authored, not human-reviewed. The Commission pages above were read; the EUR-Lex text itself was not retrievable, so article-level detail marked `opinion:` is unverified. No legal conclusions: say "no gap found in code", list evidence still needed.

## Dates (Commission pages)
In force 10 Dec 2024 · notified-body provisions (Chapter IV) 11 Jun 2026 · **Art. 14 reporting 11 Sep 2026 (already applies, also to products already on the market)** · full application 11 Dec 2027 (older products only on substantial modification). Single Reporting Platform (SRP) run by ENISA. Per the Commission, open-source stewards' reporting duties start 11 Dec 2027.

## Step 1: classify
1. **Product with digital elements?** Hardware or software (incl. separately placed components) made available on the EU market in a commercial activity, whose intended or foreseeable use includes a direct or indirect data connection. Out: non-commercial supply, and products covered by other EU legislation (Art. 2). Pure SaaS is mostly out unless it is a remote data-processing solution of a product (opinion: Art. 3 definition; check). Free/open-source: see Recital 18 for when it counts as "made available".
2. **Role** (`regulated.cra_role`): manufacturer (own name/trademark), importer (non-EU manufacturer's product into EU), distributor (no change to the product), open-source steward (supports FOSS for commercial use; lighter duties: cybersecurity policy, cooperation, reporting). Unknown → ask, record Open question.
3. **Class**: default; important class I/II (Annex III) or critical (Annex IV) by core functionality. Default = self-assessment (Module A); class I only with harmonised standards, else notified body; class II/critical = third party or EU certification scheme. needs-evidence: classification decision (product owner).

## Step 2: controls (manufacturer; importer/distributor verify these exist, steward: policy + reporting only)
| Control | Evidence expected | Stage |
|---|---|---|
| Cybersecurity risk assessment drives design (Art. 13, Annex I) | Documented assessment, linked to threat model - needs-evidence | production |
| Secure-by-default configuration, no known exploitable vulnerabilities at release (Annex I Pt I, opinion) | Hardened defaults in config, no default creds, scan results at release | pilot |
| Access control, encryption, integrity, data minimisation, attack-surface limits (Annex I Pt I, opinion) | Code/config review by SEC | pilot |
| SBOM in machine-readable format, top-level dependencies at least (Annex I Pt II, opinion) | CycloneDX/SPDX generated in CI, kept per release | production |
| Vulnerability handling: patch without delay, regular testing, public fix info (Annex I Pt II, opinion) | Dependency scanning, patch SLA, advisories process | production |
| Coordinated vulnerability disclosure policy and contact | `security.txt`/SECURITY.md published; named owner - needs-evidence | production |
| Security updates delivered separately from feature updates where technically feasible, automatic by default with opt-out (opinion) | Update mechanism in code, signed artefacts | production |
| Support period: set by manufacturer, end date (month/year) shown at purchase (Commission); minimum 5 years unless shorter expected use (Art. 13, opinion) | Stated in docs/product page; rationale - needs-evidence | production |
| Due diligence on third-party components (Art. 13) | Dependency pinning, provenance, licence/vuln checks | pilot |
| Technical documentation, user instructions, EU declaration of conformity, CE marking | needs-evidence (product owner / legal) | production |
| **24h/72h/final reporting runbook (Art. 14)** | Runbook: who decides "actively exploited"/"severe", SRP account, drills; early warning 24h, notification 72h, final report within 14 days of a fix (vulnerability) or 1 month after the 72h notice (incident) - needs-evidence (security lead) | production |

Prototype: record classification and role; everything else is a recommendation. Pilot with real users: the pilot rows. Production and market placement: all rows, owners named.

## Interaction with other packs
- **NIS2** (`eu-nis2.md`): Art. 23 incident reporting concerns the organisation's services; CRA Art. 14 concerns the product. One event may trigger both with different recipients/clocks - keep one incident runbook that fans out.
- **GDPR** (`eu-gdpr.md`): a product vulnerability exposing personal data may also be a breach (72h to the DPA); coordinate, do not merge.
- **AI Act**: high-risk AI systems meeting CRA Annex I are presumed to meet AI Act cybersecurity requirements where covered (opinion; verify).
- **DORA**: financial entities' own ICT is DORA; software they sell as a product can still be a CRA product.

Needs-evidence: role and class decision, conformity route, SRP registration, support-period commitment, CVD owner.
