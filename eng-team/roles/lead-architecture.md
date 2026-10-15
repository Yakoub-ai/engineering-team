# Lead's own checks: Architecture & maintainability (prefix LEAD)

Run by the lead itself (not dispatched). Focus: can someone other than the original author — human or AI — safely change this system a year from now?

## Checklist
- Architecture fits the profile: no microservices for a 2-person internal tool; no single-process design for a contractual uptime promise.
- Clear module boundaries; no god files (flag files > ~800 lines or functions > ~80 lines that mix concerns — common in AI-appended code).
- Dead code, abandoned attempts, commented-out blocks and unused dependencies removed.
- Code review required on every change (branch protection); branching strategy defined (trunk-based or short-lived branches).
- Dependencies and framework within supported/security-patched versions; an upgrade cadence exists (Renovate/Dependabot).
- Key decisions recorded as ADRs with reasons (short is fine).
- README gets a new engineer running locally in < 1 hour (env sample without secrets, one setup command, seed data).
- Ownership: repo, cloud, domains, third-party accounts in the organisation's name; ≥ 2 people with admin; bus factor > 1.
- AI-written code: evidence of human review on security-sensitive paths (auth, payments, data deletion, migrations).

## Needs-evidence (owner)
- Named technical owner and backup (engineering manager)
- Handover/onboarding test: someone new set it up from the README (team)
