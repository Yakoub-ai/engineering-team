# Phase 1: discover

## Purpose

Understand the problem before anyone designs a solution. Produce `docs/brief.md`, a one-page discovery brief that separates confirmed facts, assumptions and open questions, and get it approved.

## Inputs

- `.eng-team/profile.md` and `.eng-team/state.md`.
- The repository, if one exists.
- `challenger/interview.md` (question bank, pushback triggers), `challenger/coaching.md`, `challenger/citations.md`.
- `templates/brief.md`.

## Steps

1. If the repository has code, dispatch `eng-architect` with `roles/architect.md` and the scope "context scan only: current architecture, stacks, data stores, integrations, and contradictions with the profile; no options, no plan". Use its output to skip questions the repo already answers.
2. Run the interview from `challenger/interview.md` yourself in the main thread (agents cannot talk to the user). One question per message, with `Why it matters:` and a `(Recommended)` default. Skip anything the profile or the scan answers, and say what you inferred and from which file.
3. Apply the pushback triggers: vague qualities → ask for a number; a solution instead of a problem → ask what it is for; no owner → ask who is responsible; a contradiction → name it. One follow-up per trigger.
4. Update `.eng-team/profile.md` with fields learned (mark `# stated`), and add rows to state.md Open questions and Assumptions (in autonomous mode, every interview answer you defaulted is an Assumption with `Source: agent`).
5. Scan the request and brief for destructive or outside-repository operations (deleting data or cloud resources, production deploys, changing other systems). For each, follow the Hard-stop procedure now — in every autonomy mode, after step 4 so the human decides with the recorded context — and keep it out of the plan as a human-only step.
6. Write `docs/brief.md` from `templates/brief.md`: all five sections (Problem, Proposed solution, Cost and risk, Decisions needed, Status), `Audience:` line, and `Last verified against:` set to `git rev-parse --short HEAD` (or `no-commits` in a repo without commits). Keep it within about 60 lines.
7. Show the brief and ask: "Approve this brief, or tell me what to change." Apply changes and ask again until approved.
8. Record the approval in the Gates table (Approved by: the human's name, Date), set the gate to `passed` with Evidence `docs/brief.md`, and set `current_phase: research`.

## Exit criteria

- `docs/brief.md` exists, starts with `Audience:` and `Last verified against:`, and has all five sections, each with content.
- Every row in state.md Open questions asked in this phase is either answered (and the row moved to a profile field, a brief section or an Assumptions row) or recorded as an Assumptions row. Exception: in autonomous mode, "Who owns this?" may stay open while `owner: unassigned`.
- Gated: a human name and date are recorded as the approver of the discover gate.

## Autonomous mode

Do not ask questions. Each unanswered interview question becomes an Assumptions row with the conservative default from `challenger/interview.md` and `Source: agent`. Skip step 6; record `Approved by: agent`. The brief's `Decisions needed` section lists the assumptions a human should confirm later.
