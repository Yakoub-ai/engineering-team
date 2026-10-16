---
id: secure-sdlc
kind: practice
status: reviewed
tier: plugin
sources:
  - title: NIST SP 800-218 Secure Software Development Framework (SSDF) v1.1
    url: https://csrc.nist.gov/pubs/sp/800/218/final
    accessed: 2026-10-16
  - title: NIST SSDF project page
    url: https://csrc.nist.gov/projects/ssdf
    accessed: 2026-10-16
  - title: OWASP SAMM
    url: https://owaspsamm.org/model/
    accessed: 2026-10-16
  - title: SLSA specification v1.2
    url: https://slsa.dev/spec/v1.2/
    accessed: 2026-10-16
  - title: GitHub protected branches
    url: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
    accessed: 2026-10-16
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: always
---
# Practice pack: secure SDLC

Applies to every codebase. Look in CI workflows, repo settings, dependency manifests and lockfiles, build and release config, security policy files.

**Threat modelling at design**
- Threat assessment is a design-stage practice in the model — [OWASP SAMM: Threat Assessment](https://owaspsamm.org/model/design/threat-assessment/)
- Security requirements are documented for software the organisation develops, and risks and design decisions are tracked (SSDF tasks PO.1.2, PW.1.2) — [NIST SSDF project page](https://csrc.nist.gov/projects/ssdf)
- opinion: a new externally exposed component gets a written threat model before implementation.

**Scanning in CI**
- Mandatory security checks are defined in the build process, and building non-compliant artifacts fails — [OWASP SAMM: Secure Build](https://owaspsamm.org/model/implementation/secure-build/)
- Dependencies are evaluated for security issues in the same way as your own code — [OWASP SAMM: Secure Build](https://owaspsamm.org/model/implementation/secure-build/)
- opinion: secret scanning runs on every pull request and on the default branch history.
- Security testing is done as a practice, with results acted on — [OWASP SAMM: Security Testing](https://owaspsamm.org/model/verification/security-testing/)

**SBOM**
- Keep records with a bill of materials of your applications and analyse them — [OWASP SAMM: Secure Build](https://owaspsamm.org/model/implementation/secure-build/)
- opinion: generate the SBOM per release (SPDX or CycloneDX) and keep it with the artifact.

**Branch protection and review**
- Protected branches can require pull-request reviews and passing status checks, and can block force pushes — [GitHub: protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- opinion: the default branch is protected with at least one reviewer who is not the author.

**Signed builds and provenance**
- Provenance data is collected and shared for components of software releases (SSDF task PS.3.2) — [NIST SSDF project page](https://csrc.nist.gov/projects/ssdf)
- Builds run on a build platform that produces provenance describing source and builder — [SLSA v1.2: Build provenance](https://slsa.dev/spec/v1.2/build-provenance)
- Build platform requirements (isolation, provenance generation) define the build levels — [SLSA v1.2: Build requirements](https://slsa.dev/spec/v1.2/build-requirements)
- opinion: release artifacts are signed and verified before deploy.

**Vulnerability response**
- Defects, including security defects, are tracked and managed as a practice — [OWASP SAMM: Defect Management](https://owaspsamm.org/model/implementation/defect-management/)
- opinion: publish a vulnerability-response SLA by severity (for example critical within 7 days, high within 30) and a way to report issues.

## Severity hints
Secrets in the repo or no secret scanning on a production system → High. Unprotected default branch (direct push, no review) → High. No SBOM, unsigned artifacts, no vulnerability SLA → Medium. No threat model for a new externally exposed component → Medium.
