# Changelog

## 3.6.7 — 2026-10-29

### Changed
- **Parallel cap is a profile setting**: `build.max_parallel` (default 3, up to 8) in `.eng-team/profile.md` instead of a fixed 3.
- **Gate scope is a profile setting**: `build.gate: auto | per-task | per-wave`. `per-wave` sends one security spot-check per wave, with a per-task gate still for hard-gated classes. `auto` is per-wave on lean and standard and per-task on full. The gate is never skipped; nothing merges or unblocks dependents before its gate has run.
- **Builders default to Sonnet**: the architect marks a task `model: opus — <reason>` only when Sonnet is unlikely to manage it, and a task that fails twice moves to Opus. Allowing Opus raises the ceiling, not the default.
- **One resume per fix batch**: the lead resumes an agent only with new work, sending all findings and check output for a task together, never to acknowledge or ask for status. Builders work through to one terminal return.
- **Fix tasks run in parallel**: fix tasks from one loop-back are planned together, and a fix depends on another only when files overlap or it needs the other's change.

### Fixed
- **Every dispatch carries a task id**: the dispatch hook refuses an eng-team dispatch without a `Task: <id>` line (phase-level work uses a name such as `R11-review`), so no run step is untraceable. Only applies in eng-team projects.

## 3.6.6 — 2026-10-24

### Changed
- **Plan shape: register through a manifest** (`roles/architect.md`, `phases/architect.md`). Features that plug into one shared place (scene, router, registry, container) now each add their own module and entry to a small manifest created first, so the final wiring task is an import list instead of the longest task in the plan. A real run had three wiring tasks of 28, 12 and 10 minutes, each running alone.

## 3.6.5 — 2026-10-24

### Fixed
- **Dispatch log timings no longer depend on message text**: a `SubagentStart` hook records each agent instance with its id, and the summary measures first start to last stop per id (a real run showed the terminal `Status:` line in almost no stop messages, so the earlier "final return" test could not work). Falls back to harness durations, then to approximate pairing. `--summary` now also prints the source it used, a count of log lines by event and how many carry an agent id, so a gap is visible instead of silent.

## 3.6.4 — 2026-10-24

### Changed
- **Lean track builds 3 tasks at a time** (`phases/build.md`), same as the other tracks (was 2). Parallel tasks are still kept apart by the disjoint-`files` rule and the per-task scope check, so a lower cap on lean only made independent tasks wait for a slot.

## 3.6.3 — 2026-10-24

### Changed
- **Plans shaped for width** (`roles/architect.md` → Plan shape, `phases/architect.md`): a dependency is allowed only for something the task needs from its prerequisite (and says what); tasks are sized to about 5 minutes of builder work; chains deeper than 4 start with an interface-only task; wiring is last; the plan header states the critical path and maximum width. Based on a real run whose plan was 7 deep, so parallel builders could not shorten it.

## 3.6.2 — 2026-10-24

### Changed
- **Fewer re-dispatches in build**: the builder runs the repo's lint, typecheck/build and commit hooks on its changed files before returning `DONE` (never `--no-verify`, never disabling a rule), and reports each result. In per-task gate reviews only High and Medium findings send a task back; Low and Info go to the plan's `## Backlog` and are listed by the review phase. Based on a real run where 44% of builder runs were re-dispatches, 3 of them for lint or hook failures and 5 for Lows.

## 3.6.1 — 2026-10-24

### Fixed
- **Dispatch log timings**: pauses (`SubagentStop` fires whenever an agent waits) no longer count as returns; only the terminal `Status:`/`Scope:` line does. A PostToolUse hook records the duration and agent id the harness reports for each dispatch, so per-task times are exact; `--summary` prefers them and accepts `--since <ISO time>` to cover one run.

## 3.6.0 — 2026-10-24

### Changed
- **Next step is offered, not just printed** (`shared/orchestration.md` → Next step): a single-phase command now names the next step with a one-line reason and asks "Run it now?" in gated mode, or continues by itself in autonomous mode. Hard stops, Critical findings, hard-gated classes (secrets, auth, migrations, dependencies) and Deviations still ask in both modes; nothing is offered after a failed gate.
- **Namespaced command hints**: every command shown to the user is now `/eng-team:eng-<phase>` (was `/eng-<phase>`), in the orchestration rules, onboarding, engagement hand-off, init precondition and README quick start.

## 3.5.0 — 2026-10-24

### Added
- **Auto-fix of non-critical findings** (`shared/orchestration.md`): after test and review, High and Medium findings and failing flows become fix tasks and run through the build flow without asking, then the phase re-runs to prove them. Criticals, hard-gated classes (secrets, auth, migrations, dependencies), `owner: human` items and design changes always wait for the human; more than 8 items run as a sweep; a fix failing twice is escalated, never retried silently.
- **Task graph in build**: plan tasks declare `files` and `depends_on`. Independent tasks run in parallel (3 at a time, lean 2), each builder in its own worktree; a task starts only after its dependencies are verified. The lead checks each task's changed paths against its `files`, runs its acceptance check and the independent gate review, then merges serially and re-checks. A failed task blocks only its dependents. The plan is approved once, then the run continues by itself in gated mode too.
- **Deviation alerts** (`shared/orchestration.md`): any change from the approved plan (path outside `files`, task added/removed/reordered, failed prerequisite, cap hit, unplanned hard-gated item) stops new work and sends a `DEVIATION (<phase>)` message with options and a recommendation, in every autonomy mode.
- **Tiered sweep** (`/eng-sweep`, `phases/sweep.md`): default for big jobs only (8+ independent audit fixes or refactor items; `/eng-security-audit --fix` uses it too). Opus writes a plan with scan commands, item classes and caps for you to approve first; deterministic tools find the items; Sonnet triages and patches each item in its own worktree (parallelism cap, items in one file serialised); a different agent verifies each fix; merges are serial; an item that fails twice goes back to Opus, never into a third loop; Opus signs off on the real diff. Secrets, auth, migrations and dependencies are hard-gated: Opus review plus a named human. Agents return short rows, never transcripts. Haiku is not used: no eval has shown it good enough for triage. New eval case `q-sweep-plan`.
- **Viewer integration**: one **Present & needs** tab (wants and needs from the product doc and questions with edit links; sandboxed preview of each output; theme switch; Build all; "built from" links), a "Present" group in the sidebar next to the docs, and a "Used in outputs" list in the doc side panel. The viewer is the documentation overview; there is no separate overview page.
- **Product deck and product summary** (`eng-view build`, `/eng-present`): `deck.html` (16:9 slides paginated from the docs, scroll-snap, prints one slide per page, no scripts) and `product-summary.html`, themed like the other outputs.
- **`/eng-present` and `eng-view build`**: deterministic, offline generation of a themed `cheatsheet.html` and `brief.html` into `docs/present/` from the existing product, brief, architecture, ADR, STATUS and context docs. Incremental (re-renders only what changed), strict CSP, no scripts; unfilled sections are listed as gaps. New read-only agent `eng-presenter` drafts missing prose on standard and full tracks; the lead saves it into empty sections only.
- **Presentation theming foundation** (`viewer/`): five validated theme presets, bundled OFL fonts (pinned SHA-256), per-project (`.eng-team/theme.json`) or shared (`~/.eng-team/theme.json`) themes, and a small escaping template engine. Used by the `/eng-present` outputs.
- **Diagnosis handover** at loop count 2 (`shared/orchestration.md`): a short note on what failed and what was tried, then one read-only architect or researcher dispatch with a concrete recommendation before the last attempt.

- **Dispatch log** (`hooks/dispatch-log.js`): the hook appends a metadata-only JSONL line per eng-team dispatch and return to `.eng-team/.cache/dispatch-log.jsonl` (no tokens spent, real timestamps, size-capped, never blocks). Handovers gain `Loops used`; STATUS gains a Team activity line.

- **Dispatch log timings**: lines carry the `Task:` id from the dispatch prompt and the agent id on return; `node hooks/dispatch-log.js --summary <project>` prints runs and seconds per agent. Per project only.

### Changed
- **Lean outputs and viewer**: removed the deck tagline and kickers, the audience tags, "Source:" lines, "Verified against" meta, the deck footer source and the viewer's helper text. Sources stay in `data-source` and the viewer's "Built from" list.
- **Experience review (UX · DX · AX)**: an advisory section in the `product-engineer` role, run in the architect phase's plan-mode review for UI, CLI, API or agent surfaces. Never blocks; no new agent. Architect asks one UI-reference question when `has_ui: yes`.
- `/eng` keeps going into the next phase after a gate passes and stops only at approvals, hard stops, human-only questions or loop count 3.

## 3.4.0 — 2026-10-22

### Added
- **Three process tiers** (`lean` = S, `standard` = M, `full` = L) in `shared/track.md`, auto-resolved from the profile, overridable with `/eng --tier S|M|L`, upgraded one-way.
- **Model per dispatch** (`shared/track.md` → Models per dispatch): the orchestrator passes `model` on every dispatch. Floor is Sonnet for security/compliance and all code-reading for security; Opus for architecture on M and L and for the L audit; Haiku only for non-security reading and S-tier docs.
- `/eng` intake: only unclear gaps (max 5 questions), tier line, recommended approach, up to 3 challenges.

### Changed
- Agents that were `model: inherit` are now pinned to `sonnet` (the floor), so a cheap or expensive session model no longer decides role quality or cost.

## 3.3.0 — 2026-10-20

### Added
- **Client engagement flow** for consultants, in any domain (`/eng-engage`, `phases/engage.md`): scope, a plain-text pre-meeting questionnaire per team (Swedish and English, at most 12 questions, email-ready), meeting guide, day-in-the-life visit plan, workflow mapping, opportunity scoring, solution-fit recommendation (do not automate, configure what is owned, buy, build, assist only), platform evaluation matrix with cited facts and a proof-of-concept plan, and a plain-language client report. Standalone; writes only under `docs/engineering/engagement/`, `.eng-team/questionnaires/` and `.eng-team/research/`. Autonomous mode never invents stakeholder answers.
- **Agent-formulated questionnaires**: for a domain, organisation type or area with no shipped module, `eng-researcher` drafts a module (and `eng-compliance-officer` reviews the guardrails of regulated domains). Drafts are saved to `.eng-team/questionnaires/`, always `unreviewed`, validated with `scripts/validate.py --modules <dir>`, and shown to the human before use. Rules must be cited or labelled `needs-evidence`/`opinion:`.
- **Shipped question banks** (`skills/eng-team/questionnaires/`): a generic `core`, a legal worked example (three client types, seven areas: criminal, litigation, contracts-corporate, public-administrative, employment, ip, privacy-compliance) and country modules for the EU and Sweden. 67 bilingual questions. Country modules carry guardrails (GDPR Article 10, Swedish attorney confidentiality, public-sector secrecy, AI Act Annex III points 4, 5 and 8). All modules are `unreviewed` and are not legal advice; unverified points are marked `needs-evidence`.
- Validator check `questionnaires` (frontmatter, domain, bilingual fields, ids, stages, choice options, guardrails, sources) and `--modules` mode for project modules, with 13 self-tests.
- Eval cases `m-premeeting-sv`, `n-solution-fit-guardrail` and `o-new-domain-hr` and a fictional fixture `tests/fixtures/m-engagement` (run on 2026-10-20, see `tests/evals/README.md`).

### Changed
- `/eng-discover` reads `docs/engineering/engagement/brief-seed-*.md` when present.
- Validator reference check accepts one subdirectory level (for example an area module inside `questionnaires`).

## 3.2.0 — 2026-10-18

### Added
- **Guard hook** (`hooks/`): a PreToolUse hook that enforces agent lanes for `eng-team:*` subagents. Read-only roles get no shell or write access. Writes are confined to the project (symlinks resolved) and exclude `.git/`, `.eng-team/` and `docs/engineering/**`. The tech-writer may write only the reader docs. Builder and tester shell commands are denied for pushes, remote changes, `gh`, `curl | sh`, `sudo`, publish and deploy commands, cloud and machine-level installs, and network calls beyond localhost. In projects with `.eng-team/state.md` the main thread is asked before a push or deploy. A denial tells the agent to return `HARD-STOP: eng-team guard: …`. Pattern matching, not a sandbox. Without Node, eng-team agents are blocked.
- **Hand-off contract** (`shared/orchestration.md`): exact dispatch-prompt contents, a return shape per agent, validation of every return (one re-dispatch, then escalate) and guard denials handled as hard stops.
- **Preflight**: all 14 `eng-team:` agents must exist before the first dispatch; if any is missing the run stops. The general-purpose fallback is removed.
- Validator check `handoffs` (names, references, qualified types, guard rule, read-only tool lists) with 10 self-tests.
- Viewer: content-based secret detection (private keys, cloud and API tokens, literal password assignments). Matching files are excluded from the index, search, MCP tools and the page.
- Compliance pack `eu-cra` (EU Cyber Resilience Act, `unreviewed`) and profile field `regulated.cra_role`.
- `marketplace.json` description.

### Changed
- Agents are dispatched by their registered type `eng-team:<agent>`. Before, the skill named bare `eng-builder` and so on.
- Reviewers have no shell, so the lead writes the diff to a file outside the repo and passes its path (`phases/build.md` step 4, `phases/review.md`). Reviewers come from the plan task's reviewer roles.
- All 14 agents may use the `eng-team-context` MCP tools.
- Security references pinned to OWASP Top 10:2025, ASVS 5.0.0 and the OWASP LLM Top 10 (2025); AI engineer gains an Agents & MCP checklist. Packs were not re-reviewed: please re-review `stacks/web.md`, `roles/security-engineer.md` and `roles/ai-engineer.md`.
- CI: `contents: read` token, actions pinned to commit SHAs, `persist-credentials: false`, concurrency and timeout; runs the viewer and hook tests.
- Optional embeddings package pinned to 3.8.1 and installed with `--ignore-scripts` into `${CLAUDE_PLUGIN_DATA}/viewer-deps`, so plugin updates keep it.

## 3.1.0 — 2026-10-17

### Added
- Process track (`shared/track.md`, `profile.track: auto | lean | full`). Tiny, low-risk projects (prototype, low criticality, no personal/regulated data, payments or AI, one component) run a lean track: same 8 gates, hard stops and evidence rules, but each phase does the minimum that proves its exit criteria (short product/brief, curated packs only, one option + one ADR, static audit only, three docs, two reviewers, short handovers). Resolved automatically with the reason recorded; auto-upgrades to `full` when the profile changes; never auto-downgrades.
- Efficiency rules for all tracks: read each skill file once per run, batch writes, reuse the context snapshot.
- Smoke test: 4 v3 checks (lean track, STATUS, team plan, handovers) and run timing. Result: 23/23 in 313 s.

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
