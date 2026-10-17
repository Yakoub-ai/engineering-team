# <Project> — Security audit — <YYYY-MM-DD>

Mode: <static | dast | full> (chosen by <human name | agent>, reason: <one line>) · Stage: <stage> · Commit: <sha> · Roles run: <list> · Context-isolated: yes/no
Target (DAST): <url and how it was started | not run>

## Verdict
<!-- guidance: one line: ready / ready with conditions / not ready, and the blocking reason. -->

## Summary
<!-- guidance: counts by severity after triage, false positives dropped per tool, and the top 3 risks linking finding IDs. Max 8 lines. -->

| Critical | High | Medium | Low | Info | False positives dropped |
|---|---|---|---|---|---|

## Coverage
<!-- guidance: one row per layer. Status is scanned, reviewed-manually (no tool available, lower confidence) or not-run (with the reason). Record the exact command so the run is reproducible. -->

| Layer | Status | Tool + version | Command | Exit code | Raw findings | After triage |
|---|---|---|---|---|---|---|
| SAST | | | | | | |
| Secrets (tree + history) | | | | | | |
| Dependencies | | | | | | |
| IaC / config | | | | | | |
| Containers / SBOM | | | | | | |
| DAST passive | | | | | | |
| DAST active / API | | | | | | |
| Targeted probes | | | | | | |
| Manual logic review | | | | | | |

## Findings
<!-- guidance: table sorted by severity then effort, then one block per finding in the format from shared/findings.md plus a Source line (tool:<name> <rule-id> | manual, and dast when confirmed at runtime). Never print secret values; redact them. -->

| ID | Sev | Status | Title | Source | Regulation | Effort |
|---|---|---|---|---|---|---|

## Regulation map
<!-- guidance: one row per regulation that applies to the profile, listing the finding IDs that affect it. Example: GDPR Art. 32 (security of processing), NIS2 Art. 21(2) (risk-management measures), DORA Art. 9 (protection and prevention), EU AI Act Art. 15 (accuracy, robustness, cybersecurity). Only rows that apply. -->

| Regulation / article | Requirement | Findings | Status |
|---|---|---|---|

## Needs evidence (owner → artifact)
<!-- guidance: controls that cannot be verified from the repo or the local run: WAF and cloud config, production TLS, key rotation, pen-test history, incident response. -->

| Control | Owner | What to provide |
|---|---|---|

## Remediation plan
<!-- guidance: link to docs/security/remediation-plan-<YYYY-MM-DD>.md and list the first three tasks. -->

## Re-scan
<!-- guidance: filled after fixes: date, layers re-run, before/after counts, task IDs verified. Leave the heading with "not run yet" until then. -->

## Not covered
<!-- guidance: always present. Standard limits: automated DAST is not a manual penetration test or a DORA threat-led penetration test (TLPT); production configuration not in the repo; authenticated surfaces when no test user was given; third-party services; legal sign-off. Add the layers that were not-run. -->
