# Phase 3: architect

## Purpose

Choose the simplest design that meets the approved brief, challenge every significant decision, and produce an implementation plan of independently testable tasks.

## Inputs

- `docs/engineering/product/brief.md`, `.eng-team/profile.md`, `.eng-team/state.md`.
- Packs in use, `.eng-team/research/` notes.
- `roles/architect.md`, `challenger/devils-advocate.md`, `challenger/rationale-recovery.md`, `challenger/citations.md`, `challenger/coaching.md`.
- `templates/adr.md`, `templates/architecture.md`.

## Steps

0. **Existing code.** If the repo has application code and `docs/engineering/decisions/` has no ADRs, run `challenger/rationale-recovery.md` first so the options respect what was already decided and why. Then continue.
0a. **UI intake.** If `has_ui: yes` and the brief has no look-and-feel reference, ask one question: "Share a reference (screenshot, URL or brand guide), or describe three adjectives for the look? (Recommended: a reference)". Record the answer in the brief; autonomous mode records an Assumption and uses a plain accessible default.
1. Dispatch `eng-architect` with `roles/architect.md`, the brief, packs in use and research notes. Ask for options, a recommendation, ADR drafts for each significant decision, C4 context and container diagrams, the security testing strategy (`templates/architecture.md` → Security testing strategy) and the plan.
2. Present the options (trade-off rows) and the recommendation to the user in a short summary.
3. For each significant decision (the test in `challenger/devils-advocate.md`), run the devil's-advocate round yourself in the main thread: steelman, pre-mortem, assumption audit, reversibility. Ask the user to answer each challenge; record challenge, response and source in the ADR's `## Challenges raised` table.
4. Save each ADR to `docs/engineering/decisions/NNNN-<slug>.md` (next free number, 4 digits) and add a row to state.md Decisions. Save the C4 diagrams and quality attributes to `docs/architecture.md` from `templates/architecture.md`. Save the plan to `docs/engineering/plans/plan.md`: numbered tasks, each with `files` (the paths it may write), `depends_on` (task ids, or `none`), an acceptance check (a command or observable result) and reviewer roles to spot-check. Two tasks whose `files` overlap must be ordered by `depends_on`; a task that needs another task's output depends on it. Shape the plan for width (`roles/architect.md` → Plan shape): each `depends_on` names what it needs from the prerequisite, tasks are sized to about 5 minutes of builder work, deep chains start with an interface task, features that plug into one shared place register through a manifest so the final wiring task stays small, and the plan header states `Critical path: <ids> (<n> deep), max width: <n>`. The plan always includes, sized to `profile.stage`: (a) an environment task first, per `practices/environment-setup.md` (pinned toolchain, one-command setup, `.env.example`, pre-commit hooks); (b) a security-tooling task (scanners from `phases/security-audit.md` step 3 runnable with one command and as pull-request checks in CI, automated dependency updates); (c) for apps with a UI or API, DAST readiness: the app starts locally with test values, seed data, two test users and, for APIs, an OpenAPI or GraphQL schema. When saving each ADR, fill the `Decided by:` line with the approving human's name (gated) or `agent` (autonomous); never leave the template placeholder `<name> | agent`.
5. Activate reviewers using the matrix in `shared/project-profile.md` and dispatch them in `plan` mode on the design (brief, architecture, ADRs, plan). Severity cap from `shared/findings.md` applies. This includes the experience review: the product-engineer runs the "Experience review (UX · DX · AX)" section of its role when `has_ui: yes` or the design exposes a CLI, API or agent interface. It is advisory and never blocks a gate; add accepted `Change` items to the plan.
6. For each Critical: send it back to `eng-architect` to revise the design (increment Loop counter `architect→eng-architect`; Critical findings still wait for the human's choice in every mode), or the human accepts it as a risk in state.md Accepted risks (name, date, review-on date; refused while `owner` is `unassigned` or `unknown`: ask for an owner first). High and below are listed for the user and added to the plan where they need work.
7. Run the Gap review first (`shared/orchestration.md`). Then ask: "Approve the design and plan, or tell me what to change." Record approver and date; set the gate to `passed` via Running a phase in `shared/orchestration.md` (handover, STATUS, team plan first) (Evidence: ADR paths, `docs/engineering/plans/plan.md`) and `current_phase: build`.

## Exit criteria

- At least 2 options were considered and appear in the ADRs' `Options considered`.
- Every significant decision has an ADR whose `## Challenges raised` table has at least one row with a response. ADRs with `Recovered: yes` are exempt: their Challenges table may be empty until the decision is revisited.
- No open Critical from the plan-mode review.
- Every task in `docs/engineering/plans/plan.md` has `files`, `depends_on`, an acceptance check and reviewer roles, and no two unordered tasks share a file; the plan header states its critical path and width, and every dependency names what it needs.
- `docs/architecture.md` has a Security testing strategy, and the plan contains the environment, security-tooling and (UI/API projects) DAST-readiness tasks.
- Gated: a human name and date are recorded as approver of the architect gate.
- The handover `docs/engineering/handovers/03-architect.md` exists and STATUS.md is current.

## Autonomous mode

Write each challenge response yourself; ADRs get `Decided by: agent`; record `Approved by: agent`. Skip the approval question in step 7 but still run the Gap review silently: record open items as Assumptions, mirror them into `docs/engineering/questions.md` and update the STATUS open-question count. Still stop and ask the human for any one-way-door decision touching data deletion, residency or security boundaries, and for any Critical (hard stops: follow the Hard-stop procedure in `shared/orchestration.md`, log `hard-stop architect: <reason>`).
