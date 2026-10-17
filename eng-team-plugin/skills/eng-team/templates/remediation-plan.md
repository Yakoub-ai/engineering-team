# <Project> — Remediation plan — <YYYY-MM-DD>

Source report: `docs/security/security-audit-<YYYY-MM-DD>.md` · Commit audited: <sha>

## How to execute
<!-- guidance: 3-6 lines. Tasks run in order. Each task: fix, regression test, acceptance check. Agents commit locally only. To execute with the team: /eng-security-audit --fix, or /eng-build when the project runs the eng-team lifecycle. Tasks with owner: human are never done by an agent. -->

## Batches
<!-- guidance: Now = Critical and exploitable High (days). Before production = remaining High and the Medium items the stage requires. Hardening = Medium/Low backlog. Use the stage to decide what is required now. -->

## Tasks
<!-- guidance: one block per task, ordered by batch, then severity, then effort. Group findings that share a root cause into one task. -->

```
### R-NN: <title>   [batch: now | before-production | hardening]
- Closes: SEC-NNN, CMP-NNN
- Owner: agent (eng-builder) | human (<role>)
- Fix: <concrete change, files and functions; code snippet when it helps>
- Files: path/to/file.ts, path/to/config.yml
- Regression test: <test path and what it asserts>
- Acceptance check: <exact command that re-runs the tool rule or probe that found it, and the expected result>
- Effort: S | M | L
- Deadline: <YYYY-MM-DD, required for owner: human>
- Status: open | in-progress | verified | failed | accepted-risk (<name>, <date>, review on <date>)
```

## Human-only actions
<!-- guidance: secret rotation, git history purge, cloud and WAF settings, DPA and vendor actions, breach assessment (GDPR Art. 33: 72 hours to notify the supervisory authority once the controller is aware of a personal-data breach), regulator or customer notification. Each with owner role and deadline. -->

| Action | Why | Owner | Deadline | Status |
|---|---|---|---|---|

## Prevent recurrence
<!-- guidance: CI controls that stop these classes coming back: the scanners from the audit as pull-request checks, secret scanning with push protection, dependency update automation, ZAP baseline in CI against a preview environment. Cite practices/secure-sdlc.md. Max 8 lines. -->
