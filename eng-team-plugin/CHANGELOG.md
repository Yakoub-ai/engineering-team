# Changelog

## 2.1.0 — 2026-10-17

### Added
- `/eng-security-audit [auto|static|dast|full] [--target <url>] [--fix] [paths]`: a standalone security audit backed by real tools, for any repo, whether or not eng-team built it. The static layer runs Semgrep, gitleaks (full history), osv-scanner, Trivy/Checkov and Syft (SBOM). The DAST layer starts the app locally, then runs ZAP baseline, full and API scans plus targeted probes. `auto` recommends a mode and gives the reason. Agents triage tool findings, add logic flaws and map each finding to GDPR, NIS2, DORA and the AI Act.
- `phases/security-audit.md`, `templates/security-report.md`, `templates/remediation-plan.md`. Reports go to `docs/security/`.
- `--fix` carries out the remediation plan (builder, then tester, then the acceptance check re-runs the scan rule that found the issue), followed by a re-scan section in the report.
- Findings gain an optional `Source:` line (`tool:<name> <rule-id>` | `manual` [+ `dast`]).

### Changed
- Lifecycle review (phase 7, `review` mode) runs the static scan layer first when scanners are installed.
- Hard-stop scope: in a security audit, running installed scanners and starting the app on localhost are in scope. Installing tools, pulling images and scanning non-local targets stop and ask.
- "Not covered" now separates automated DAST (covered) from manual and threat-led penetration testing (not covered).

## 2.0.0 — 2026-10-16

### Added
- claude.ai support: `scripts/package-claude-ai.sh` builds `dist/eng-team-skill.zip` for upload as a skill, with a `claude.ai mode` section in the skill and a README guide.
- Lifecycle phases: init, discover, research, architect, build, test, document, review, with gates recorded in `.eng-team/state.md` (resumable, with a state-integrity check).
- Five new agents: `eng-researcher`, `eng-architect`, `eng-builder`, `eng-tester`, `eng-tech-writer` (14 agents in total with the nine reviewers).
- Challenger: interview, devil's-advocate round, citations rule and coaching.
- Practices packs: ADR writing, API design, observability, secure SDLC, testing pyramid, twelve-factor.
- Templates for the profile, state, brief, architecture, ADR, testing, runbook, evidence log, docs index and packs.
- Project state: `.eng-team/profile.md` (scope contract) and `.eng-team/state.md` (gates, assumptions, decisions, packs in use, accepted risks, loop counters).
- Commands: `/eng`, `/eng-init`, `/eng-discover`, `/eng-research`, `/eng-architect`, `/eng-build`, `/eng-test`, `/eng-document`, `/eng-review`, `/eng-promote`.
- Federation: shared standards repo via `profile.standards`, plus `/eng-promote` to promote a reviewed project pack.
- Validator: `scripts/validate.sh` with self-tests, run in CI.
- Evals: eight end-to-end cases for `claude plugin eval` under `tests/evals/`.

### Changed
- Packs gained frontmatter (`id, kind, status, tier, sources, reviewed_by, review_by, applies_when`).
- The orchestrator now drives the lifecycle instead of only reviewing.
- The `plugin.json` description now reads: "Full-lifecycle engineering team: interviews and challenges, researches with citations, architects (options, ADRs, C4), builds and tests behind gates or autonomously, documents, and reviews for security and EU/other compliance."

### Migration (from 1.0.0)
- `/eng-review` gives the old v1 behaviour (read-only review and gate). It needs no profile and never changes lifecycle gates.
- Run `/eng-init` once per project to use the lifecycle commands.

## 1.0.0

Initial release: review-only. An `eng-lead` orchestrator and nine read-only specialist reviewers (security, EU compliance, data, platform, SRE, QA, integrations, AI, product).
