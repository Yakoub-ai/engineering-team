# Phase 1: discover

## Purpose

Understand the product and the problem before anyone designs a solution. Produce `docs/engineering/product/product.md` (users, use cases, usage, success metrics, non-goals) and, derived from it, `docs/engineering/product/brief.md`, a one-page discovery brief that separates confirmed facts, assumptions and open questions. Get the brief approved.

## Inputs

- `.eng-team/profile.md` and `.eng-team/state.md`.
- The repository, if one exists.
- `challenger/brainstorm.md`, `challenger/product-discovery.md`, `challenger/interview.md` (question bank, pushback triggers), `challenger/coaching.md`, `challenger/citations.md`.
- `templates/product.md`, `templates/brief.md`.

## Steps

0. Brainstorm, when triggered. If the request is an idea rather than a defined product (no users, no use case, or "I want to build something that…"), or the human asks, run `challenger/brainstorm.md` in the main thread. Otherwise skip it and say so.
1. Context. Start from the context engine's output (`shared/context.md`, snapshot `.eng-team/context.md`) and show its What I know output. If the repository has code and the snapshot does not cover an area the brief needs, dispatch `eng-architect` with `roles/architect.md` and the scope "context scan only, for these areas: <uncovered areas>: current architecture, stacks, data stores, integrations, and contradictions with the profile; no options, no plan". Do not dispatch it for areas the snapshot already holds. Use the snapshot and the scan to skip questions the repo already answers.
2. Product discovery. Run `challenger/product-discovery.md` yourself in the main thread (agents cannot talk to the user) and write `docs/engineering/product/product.md` from `templates/product.md`.
3. Run the requirements interview from `challenger/interview.md` for what product discovery did not cover. One question per message, with `Why it matters:` and a `(Recommended)` default. Skip anything the profile, the product document or the scan answers, and say what you inferred and from which file.
4. Apply the pushback triggers: vague qualities → ask for a number; a solution instead of a problem → ask what it is for; no owner → ask who is responsible; a contradiction → name it. One follow-up per trigger.
5. Update `.eng-team/profile.md` with fields learned (mark `# stated`), and add rows to state.md Open questions and Assumptions (in autonomous mode, every question you defaulted is an Assumption with `Source: agent`).
6. Scan the request, product.md and brief for destructive or outside-repository operations (deleting data or cloud resources, production deploys, changing other systems). For each, follow the Hard-stop procedure now — in every autonomy mode, after step 5 so the human decides with the recorded context — and keep it out of the plan as a human-only step.
7. Write `docs/engineering/product/brief.md` from `templates/brief.md`, derived from product.md: all five sections (Problem, Proposed solution, Cost and risk, Decisions needed, Status), `Audience:` line, and `Last verified against:` set to `git rev-parse --short HEAD` (or `no-commits` in a repo without commits). Cite the use cases it covers by their UC IDs from product.md. Keep it within about 60 lines.
8. Run the Gap review first (`shared/orchestration.md`). Then show the brief and the team plan (`docs/engineering/team-plan.md`) and ask: "Approve this brief and the team plan, or tell me what to change." Apply changes and ask again until approved.
9. Record the approval in the Gates table (Approved by: the human's name, Date), set the gate to `passed` with Evidence `docs/engineering/product/brief.md`, and set `current_phase: research`.

## Exit criteria

- `docs/engineering/product/product.md` exists, starts with `Audience:` and `Last verified against:`, and has at least 3 use cases, at least one persona, at least one numeric success metric, and non-goals.
- `docs/engineering/product/brief.md` exists, starts with `Audience:` and `Last verified against:`, has all five sections, each with content, and cites UC IDs from product.md.
- Every row in state.md Open questions asked in this phase is either answered (and the row moved to a profile field, a product or brief section or an Assumptions row) or recorded as an Assumptions row. Exception: in autonomous mode, "Who owns this?" may stay open while `owner: unassigned`.
- Gated: a human name and date are recorded as the approver of the discover gate, covering the brief and the team plan.
- The handover `docs/engineering/handovers/01-discover.md` exists and STATUS.md is current.

## Autonomous mode

Do not ask questions. Skip brainstorming unless the request has no discernible product; then pick per `challenger/brainstorm.md`. Each unanswered question in product discovery and the interview becomes an Assumptions row with the conservative default and `Source: agent`. Skip step 8; record `Approved by: agent`. The brief's `Decisions needed` section lists the assumptions a human should confirm later.
