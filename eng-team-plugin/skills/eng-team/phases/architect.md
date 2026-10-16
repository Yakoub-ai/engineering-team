# Phase 3: architect

## Purpose

Choose the simplest design that meets the approved brief, challenge every significant decision, and produce an implementation plan of independently testable tasks.

## Inputs

- `docs/brief.md`, `.eng-team/profile.md`, `.eng-team/state.md`.
- Packs in use, `.eng-team/research/` notes.
- `roles/architect.md`, `challenger/devils-advocate.md`, `challenger/citations.md`, `challenger/coaching.md`.
- `templates/adr.md`, `templates/architecture.md`.

## Steps

1. Dispatch `eng-architect` with `roles/architect.md`, the brief, packs in use and research notes. Ask for options, a recommendation, ADR drafts for each significant decision, C4 context and container diagrams, and the plan.
2. Present the options (trade-off rows) and the recommendation to the user in a short summary.
3. For each significant decision (the test in `challenger/devils-advocate.md`), run the devil's-advocate round yourself in the main thread: steelman, pre-mortem, assumption audit, reversibility. Ask the user to answer each challenge; record challenge, response and source in the ADR's `## Challenges raised` table.
4. Save each ADR to `docs/adr/NNNN-<slug>.md` (next free number, 4 digits) and add a row to state.md Decisions. Save the C4 diagrams and quality attributes to `docs/architecture.md` from `templates/architecture.md`. Save the plan to `.eng-team/plan.md`: numbered tasks, each with files, an acceptance check (a command or observable result) and reviewer roles to spot-check.
5. Activate reviewers using the matrix in `shared/project-profile.md` and dispatch them in `plan` mode on the design (brief, architecture, ADRs, plan). Severity cap from `shared/findings.md` applies.
6. For each Critical: send it back to `eng-architect` to revise the design (increment Loop counter `architect→eng-architect`; Critical findings still wait for the human's choice in every mode), or the human accepts it as a risk in state.md Accepted risks (name, date, review-on date; refused while `owner` is `unassigned` or `unknown`: ask for an owner first). High and below are listed for the user and added to the plan where they need work.
7. Ask: "Approve the design and plan, or tell me what to change." Record approver and date; set the gate to `passed` (Evidence: ADR paths, `.eng-team/plan.md`) and `current_phase: build`.

## Exit criteria

- At least 2 options were considered and appear in the ADRs' `Options considered`.
- Every significant decision has an ADR whose `## Challenges raised` table has at least one row with a response.
- No open Critical from the plan-mode review.
- Every task in `.eng-team/plan.md` has an acceptance check and reviewer roles.
- Gated: a human name and date are recorded as approver of the architect gate.

## Autonomous mode

Write each challenge response yourself; ADRs get `Decided by: agent`; record `Approved by: agent`. Still stop and ask the human for any one-way-door decision touching data deletion, residency or security boundaries, and for any Critical (hard stops: follow the Hard-stop procedure in `shared/orchestration.md`, log `hard-stop architect: <reason>`).
