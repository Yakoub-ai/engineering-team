# Findings contract

All roles return findings in exactly this format. The lead merges them.

## Severity

| Severity | Meaning | Examples |
|---|---|---|
| **Critical** | Exploitable now, or active legal/regulatory breach, or data loss likely | Secret in repo, IDOR on customer data, no authZ on admin API, special-category data sent to a non-EU LLM without basis |
| **High** | Serious weakness needing a precondition, or a missing control required at the current stage | No rate limit on login, no backup restore ever tested (production), migrations without rollback |
| **Medium** | Defense-in-depth gap or reliability risk | Missing security headers, no structured logs, no pagination limits |
| **Low** | Hygiene, maintainability | Dead code, outdated non-vulnerable deps |
| **Info** | Observation, no action required now | Future-stage requirement |

Adjust by stage: a gap that is High in production can be Low in prototype. Say so in the finding.

## Status

- `confirmed` — evidence shows the problem
- `suspected` — indicators but not proven; state what would confirm it
- `needs-evidence` — cannot be verified from available material; name who must provide what
- `pass` — only list when the user asks for a full control map; must cite evidence

## Pack provenance and severity cap
Every finding derived from a pack names it in `Refs` as `pack:<id>(<tier>/<status>)`.
Findings whose only basis is an `unreviewed` pack are capped at **High** — unless the check quotes a regulation article verbatim with its citation, in which case Critical is allowed.

## Recovered decisions
An ADR with `Status: accepted (recovered)` records a past decision and its stated trade-off. Treat that trade-off as context. A finding that contradicts a recovered ADR cites it in `Refs` (for example `ADR-0003`) and proposes revisiting the ADR; it must not silently override it.

## Findings ledger
The lead keeps `.eng-team/findings.jsonl`, one JSON line per finding and one more per status change: `id`, `path:line` (every location), `severity`, `class` (the bug class, e.g. `idor`, `sql-injection`, `missing-test`), `status` (`open`, `upheld`, `rejected`, `fixed`, `accepted`, `backlog`), `round`, `source` (the role, or `found-by-verifier`) and, for `rejected`, the reason. Reviewers receive it with every gate and review dispatch: they do not re-report an entry, and a new instance of a known class is reported under that class so one fix covers every location. Only the lead writes it.

## Agent return markers
Agents that write (builder, tester, tech-writer) end with `Status: DONE | BLOCKED | HARD-STOP`.
Reviewers, architect and researcher end with `Scope reviewed:` / `Scope:` (full table: Hand-off contract in `shared/orchestration.md`).
Any agent that hits a hard stop, or whose tool call is denied with `eng-team guard:`, returns a line `HARD-STOP: <reason>` — the orchestrator pauses regardless of autonomy.

## Finding format

```
### [SEV] ROLE-NNN: <short title>
- Status: confirmed | suspected | needs-evidence
- Evidence: path/to/file.ts:42 — <what is there> | searched: <patterns> in <paths>, none found
- Impact: <what can go wrong, for whom>
- Fix: <concrete change; code-level when possible>
- Effort: S | M | L
- Refs: OWASP A01 / GDPR Art. 32 / DORA Art. 9 / CWE-639 (only what applies)
- Source: tool:<name> <rule-id> | manual [+ dast] (security audit only; see phases/security-audit.md)
```

Role prefixes: SEC, CMP, DAT, PLT, SRE, QA, INT, AI, PRD, LEAD, RES, ARC, BLD, TST, DOC.

## Report template (lead)

```
# Engineering review — <project> — <date>
Mode: <mode> · Stage: <stage> · Roles run: <list> · Context-isolated: yes/no

## Verdict
<one line: ready / ready with conditions / not ready — and the blocking reason>

## Top risks
<max 5 bullets, each linking a finding ID>

## Findings
| ID | Sev | Status | Title | Effort |
<table, sorted by severity then effort>

<finding details>

## Needs evidence (owner → artifact)
<table: control · owner · what to provide>

## Trade-offs decided
<conflicts between roles and how the priority order resolved them>

## Not covered
<scope exclusions + standard limits>
```
