# Process track (lean vs full)

Rule 6 in `SKILL.md` scales *requirements* by stage. This file scales the *process*: how much ceremony each phase spends. Every track keeps the same 8 gates, the same hard stops, evidence rules and secret handling. Only depth and length change.

## Choosing the track

`profile.track` is `auto` (default), `lean` or `full`. With `auto`, resolve it at init or onboard and record the result in the profile as `track: lean # resolved: <reason>` or `track: full # resolved: <reason>`.

`lean` when **all** hold:
- `stage: prototype` and `criticality: low`
- `data_classes: [none]`, `payments: none`, `ai_usage: none`
- `regulated.financial_entity: no`, `regulated.ai_act_role: none`, and `regulated.nis2_entity` is `no` or `unknown` with `users: internal`
- `tenancy: single` and one deployable component (one service, CLI, library or static site)

Otherwise `full`. The human may set either explicitly at any time.

**Auto-upgrade.** At every State integrity run, re-check the conditions. If a profile change breaks one (new data class, stage change, a second component, regulated status), switch to `full`, log `- YYYY-MM-DD track: lean → full (<reason>)`, and tell the human. Never auto-downgrade.

## Lean track, per phase

Where this list conflicts with a phase file's steps or exit criteria, the lean rule wins. Anything not listed runs as written.

| Phase | Lean rule |
|---|---|
| init / onboard | No questions for fields the request or repo answers. In autonomous mode, defaults become Assumptions; ask nothing. Team plan is a single table. |
| discover | Skip brainstorming unless the request has no product. `product.md` ≤ 20 lines (purpose, 1-3 use cases, one numeric success metric, non-goals). Brief ≤ 20 lines. Interview only for contradictions or missing owner. |
| research | Curated packs only; no researcher dispatch for unmatched stacks — list them as `Info` gaps instead. `best-practices.md` ≤ 30 lines, one section per pack in use. |
| architect | One recommended option with one line per rejected alternative (satisfies "options considered"). At most one ADR, for the single most significant decision, with one devil's-advocate challenge. Plan ≤ 5 tasks; environment and security-tooling tasks may be one combined task. Security testing strategy ≤ 3 lines. Plan-mode review: `security-engineer` only. |
| build | One combined gate-mode spot-check by `security-engineer` per task. |
| test | Static audit layer only (`phases/security-audit.md` step 4, `reviewed-manually` where no tool exists); no DAST. Audit report ≤ 40 lines. |
| document | `docs/README.md`, `docs/architecture.md` (≤ 40 lines) and `docs/testing.md` only; runbook only if deployed beyond a local machine. |
| review | `security-engineer` and `qa-engineer` only, `review` mode; report ≤ 40 lines with the Not covered section. |
| every gate | Handover ≤ 10 lines; STATUS ≤ 25 lines; Next up note ≤ 2 lines. Write each file once per gate — no re-reads to verify what you just wrote. |

## Efficiency rules (all tracks)

- Read each skill file once per run; do not re-read a file you already hold.
- Batch independent file writes in one step.
- Do not re-scan the repository inside a phase when the context snapshot already holds the facts (`shared/context.md`).
