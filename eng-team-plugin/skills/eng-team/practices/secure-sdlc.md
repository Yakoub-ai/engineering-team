---
id: secure-sdlc
kind: practice
status: reviewed
tier: plugin
sources:
  - title: NIST SP 800-218 Secure Software Development Framework (SSDF) v1.1
    url: https://csrc.nist.gov/pubs/sp/800/218/final
    accessed: 2026-10-16
  - title: OWASP SAMM
    url: https://owaspsamm.org/model/
    accessed: 2026-10-16
  - title: SLSA specification v1.0
    url: https://slsa.dev/spec/v1.0/
    accessed: 2026-10-16
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: always
---
# Practice pack: secure SDLC

Applies to every codebase. Look in CI workflows, repo settings, dependency manifests and lockfiles, build and release config, security policy files.

**Threat modelling at design**
- Threat assessment and security requirements are done at design time, before implementation; results feed the backlog — [OWASP SAMM: Design](https://owaspsamm.org/model/)
- Security requirements are derived from risk and reviewed against the architecture — [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)

**Scanning in CI**
- Dependency vulnerability scanning and secret scanning run on every pull request and fail the build above an agreed severity — [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final), [OWASP SAMM: Implementation](https://owaspsamm.org/model/)
- Static analysis or security testing runs in the pipeline, with results triaged — [OWASP SAMM: Verification](https://owaspsamm.org/model/)

**SBOM**
- A software bill of materials is generated per release and kept with the artifact — [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
- Third-party components are inventoried and tracked for known vulnerabilities — [OWASP SAMM: Secure Build](https://owaspsamm.org/model/)

**Branch protection and review**
- The default branch is protected: required review by someone other than the author, required status checks, no force-push — [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
- Code changes are reviewed for security issues before merge — [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)

**Signed builds and provenance**
- Builds run on a controlled build platform from versioned source and are reproducible from config — [SLSA v1.0](https://slsa.dev/spec/v1.0/)
- Release artifacts carry provenance (what source, what builder) and, where practical, are signed and verified before deploy — [SLSA v1.0](https://slsa.dev/spec/v1.0/)
- Note: v1.0 is retired; the current spec is v1.2 at the same site, use it for level wording — [SLSA v1.0](https://slsa.dev/spec/v1.0/)

**Vulnerability response**
- A documented process exists to receive, triage and fix reported vulnerabilities, with SLAs by severity (for example critical in days) — [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
- Root causes of fixed vulnerabilities are analysed to prevent recurrence — [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final), [OWASP SAMM: Defect Management](https://owaspsamm.org/model/)

## Severity hints
Secrets in the repo or no secret scanning on a production system → High. Unprotected default branch (direct push, no review) → High. No SBOM, unsigned artifacts, no vulnerability SLA → Medium. No threat model for a new externally exposed component → Medium.
