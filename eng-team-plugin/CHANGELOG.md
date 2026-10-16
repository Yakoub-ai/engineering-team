# Changelog

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
