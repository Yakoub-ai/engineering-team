# Changelog

## 3.0.0 — 2026-10-17

### Added
- **Context engine** (`shared/context.md`, `templates/context.md`): reuses what is already known (`.eng-team/context.md` snapshot, CLAUDE.md, Claude auto-memory read-only, docs) before scanning code, re-scans only what changed, and opens every run with a "What I know" block. CLAUDE.md gets a marked eng-team block: written when missing, merge proposed (never applied without approval) when it exists.
- **Product understanding**: brainstorming (`challenger/brainstorm.md`) and product discovery (`challenger/product-discovery.md`, `templates/product.md`): purpose, personas, use cases, usage, non-goals, success metrics, constraints, directions considered.
- **Rationale recovery** (`challenger/rationale-recovery.md`): up to 8 questions on why significant or risky existing decisions were made, recorded as recovered ADRs that reviewers must cite before challenging.
- **Best-practice research output**: `docs/engineering/specs/best-practices.md` per project, with ad-hoc research answers.
- **Transparency**: team plan (agents per phase, what, when, outputs, your touchpoints), Next up notes before each phase, a handover file per phase, a rolling `STATUS.md`, `questions.md` with a Gap review before every approval.
- **Visual workspace and agent context** (`viewer/`, `/eng-view`, `.mcp.json`): local, zero-dependency Node index of docs and code with a connected map, in-place doc editing, code view, handover timeline, optional local embeddings, and the `eng-team-context` MCP server (`search_context`, `get_related`, `changed_since`, `get_doc`).
- Eval `l-context-reuse`.

### Changed
- **Layout**: engineering record moves to `docs/engineering/` (brief → `product/brief.md`, ADRs → `decisions/`, plan → `plans/plan.md`, onboarding, handovers, STATUS, team plan, questions). State integrity proposes a one-time `git mv` for existing projects. Onboarding never moves files; it proposes the migration as a question.
- The lead owns `docs/engineering/**`; the tech-writer owns the reader docs.
- Onboarding is read-only: Critical findings drive the recommended entry point instead of a hard stop; the team never changes autonomy on its own.

### Migration (from 2.x)
- Run any eng-team command in an initialised project; State integrity lists old paths and proposes the `git mv` batch (gated mode asks first).

## 2.3.0 — 2026-10-17

### Added
- `/eng-onboard` and `phases/onboard.md`: join an existing project in any state. Scans code, docs and git history; infers the stage with evidence; maps existing artifacts to the lifecycle gates and adopts them as evidence; runs a read-only environment and security health check; asks up to five context questions (situation and goal, stage, pain points, deadlines, missing profile fields); writes `docs/onboarding-<date>.md` from `templates/onboarding.md` and recommends an entry point. `/eng` routes to it when the repo already has code and no state.
- Evals i, j and k for the security audit, environment check and onboarding, sharing one small fixture (`tests/fixtures/i-legacy-app`).

## 2.2.0 — 2026-10-17

### Added
- Security testing is part of the lifecycle. Architect writes a Security testing strategy and always plans environment, security-tooling and DAST-readiness tasks. Build scans each task's diff. Test runs the security audit (full when the app runs locally) and loops Critical/High findings back to build. Review re-audits what changed. Document adds Security testing to `docs/testing.md` and Vulnerability response to the runbook.
- Continuous security testing (`shared/orchestration.md`): stage-based cadence, event triggers (lockfile/IaC/endpoint/auth/stage changes), a `Security audits` table in `state.md` with `Next due`, and a due check on every start.
- `/eng-setup [check|install|update]` and `phases/setup.md`: the team sets up, automates and updates project environments (pinned toolchain, one-command setup, local services, devcontainer, pre-commit, CI security checks, Dependabot/Renovate, batched dependency updates).
- `practices/environment-setup.md` pack (devcontainers, mise, pre-commit, Dependabot, Renovate, GitHub Actions hardening, OpenSSF Scorecard, Twelve-Factor).
- Profile: `security_testing.dast_target` and `security_testing.cadence`.

### Changed
- Machine-level installs, updates and image pulls are asked once per run as one consolidated command, then run and verified by the team (previously the team only suggested commands).

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
