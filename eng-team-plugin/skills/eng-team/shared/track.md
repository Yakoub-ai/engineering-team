# Process track (lean / standard / full)

Rule 6 in `SKILL.md` scales *requirements* by stage. This file scales the *process*: how much ceremony each phase spends. Every track keeps the same 8 gates, the same hard stops, evidence rules and secret handling. Only depth and length change.

## Choosing the track

`profile.track` is `auto` (default), `lean`, `standard` or `full`. Tiers: lean = S (script, one integration), standard = M (service, internal tool), full = L (platform, regulated or sensitive data). The human can override at any time (`/eng --tier S|M|L`). With `auto`, resolve it at init or onboard and record the result in the profile as `track: lean # resolved: <reason>` or `track: full # resolved: <reason>`.

`lean` when **all** hold:
- `stage: prototype` and `criticality: low`
- `data_classes: [none]`, `payments: none`, `ai_usage: none`
- `regulated.financial_entity: no`, `regulated.ai_act_role: none`, and `regulated.nis2_entity` is `no` or `unknown` with `users: internal`
- `tenancy: single` and one deployable component (one service, CLI, library or static site)

`full` when **any** holds: `stage` is production or scale; `criticality` is important or critical; `data_classes` includes special-category, financial, credentials, children or health; `payments` is not none; `regulated.financial_entity: yes`, `regulated.ai_act_role` is not none, or `regulated.nis2_entity: yes`; `tenancy` is multi; or three or more deployable components.

Otherwise `standard`. The human may set any tier explicitly. State the chosen tier and the reason in one line and let the human override before the first dispatch.

**Auto-upgrade.** At every State integrity run, re-check the conditions. If a profile change breaks one (new data class, stage change, a second component, regulated status), switch up to the tier the conditions now give, log `- YYYY-MM-DD track: <old> → <new> (<reason>)`, and tell the human. Never auto-downgrade.

## Standard track, per phase

Runs the phase files as written, except: research uses curated packs plus at most one researcher dispatch per unmatched stack; reviewers in plan, gate and review modes are limited to `security-engineer`, `qa-engineer` and the roles whose lane the diff or profile touches (at most 4); audit is static unless the profile has an internet-facing endpoint; document skips the runbook unless deployed beyond a local machine. Handover ≤ 15 lines.

## Lean track, per phase

Where this list conflicts with a phase file's steps or exit criteria, the lean rule wins. Anything not listed runs as written.

| Phase | Lean rule |
|---|---|
| init / onboard | No questions for fields the request or repo answers. In autonomous mode, defaults become Assumptions; ask nothing. Team plan is a single table. |
| discover | Skip brainstorming unless the request has no product. `product.md` ≤ 20 lines (purpose, 1-3 use cases, one numeric success metric, non-goals). Brief ≤ 20 lines. Interview only for contradictions or missing owner. |
| research | Curated packs only; no researcher dispatch for unmatched stacks — list them as `Info` gaps instead. `best-practices.md` ≤ 30 lines, one section per pack in use. |
| architect | One recommended option with one line per rejected alternative (satisfies "options considered"). At most one ADR, for the single most significant decision, with one devil's-advocate challenge. Plan ≤ 5 tasks; environment and security-tooling tasks may be one combined task. Security testing strategy ≤ 3 lines. Plan-mode review: `security-engineer` only, plus `product-engineer` for the experience review only when the product is mostly a UI, CLI or agent interface. |
| build | One combined gate-mode spot-check by `security-engineer` per task. |
| test | Static audit layer only (`phases/security-audit.md` step 4, `reviewed-manually` where no tool exists); no DAST. Audit report ≤ 40 lines. |
| document | `docs/README.md`, `docs/architecture.md` (≤ 40 lines) and `docs/testing.md` only; runbook only if deployed beyond a local machine. |
| review | `security-engineer` and `qa-engineer` only, `review` mode; report ≤ 40 lines with the Not covered section. |
| every gate | Handover ≤ 10 lines; STATUS ≤ 25 lines; Next up note ≤ 2 lines. Write each file once per gate — no re-reads to verify what you just wrote. |

## Efficiency rules (all tracks)

- Read each skill file once per run; do not re-read a file you already hold.
- Batch independent file writes in one step.
- Do not re-scan the repository inside a phase when the context snapshot already holds the facts (`shared/context.md`).

## Models per dispatch

Pass the Agent tool's `model` parameter on every dispatch from this table; it overrides the agent file's default. Never go below the **floor**: Sonnet for every role, and never Haiku for anything that reads code for security, auth, input handling or secrets, nor for security or compliance review. Do not downgrade because the session model is cheaper.

| Role / work | lean (S) | standard (M) | full (L) |
|---|---|---|---|
| architect (design, ADRs, plan) | sonnet | opus | opus |
| security-engineer, compliance-officer (review, audit) | sonnet | sonnet | opus for the audit and review phases, sonnet in per-task gate spot-checks |
| builder, tester, other reviewers | sonnet | sonnet | sonnet |
| researcher | sonnet | sonnet | sonnet |
| tech-writer | haiku | sonnet | sonnet |
| presenter (gap prose for cheatsheet, brief, summary, deck) | haiku | sonnet | sonnet |
| non-security reading (context scan, file inventory, summaries) | haiku | haiku | haiku |

The human may override a model for a run; a request below the floor is refused and logged. Log each non-default choice once in state.md (`- YYYY-MM-DD model: <role> <model> (<tier>)`).
