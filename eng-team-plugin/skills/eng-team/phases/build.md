# Phase 4: build

## Purpose

Implement the approved plan one task at a time, each verified by you and spot-checked by reviewers before the next task starts.

## Inputs

- `.eng-team/plan.md`, ADRs in `docs/adr/`, `docs/architecture.md`.
- Packs in use, `roles/builder.md`, `shared/findings.md`.

## Steps

1. Take the first task in `.eng-team/plan.md` not marked done. Fix tasks `F<n>` appended by a loop-back (see Loop-back in `shared/orchestration.md`) run through this same flow, including step 4. Dispatch `eng-builder` with `roles/builder.md` and that task only (plus the ADRs it cites and the packs in use).
2. On `Status: BLOCKED`, answer the question (ask the user if needed) and re-dispatch. On `HARD-STOP:`, follow the Hard-stop procedure in `shared/orchestration.md`.
3. On `Status: DONE`, run the task's acceptance check yourself and read the output. Do not trust the report. A failed check goes back to the builder (Loop counter `build:<task id>→eng-builder`).
4. Dispatch the reviewer roles listed on the task in `gate` mode (the spot-check reviewers, per `phases/build.md`), scoped to the task's diff (`git diff` of the files the task changed).
5. A High finding goes back to `eng-builder` with the finding (same Loop counter). At count 3, escalate to the human. A Critical finding (after the severity cap) never loops automatically: set the gate to `failed`, log it, and ask the human in every mode to choose fix (re-dispatch the builder) or accept the risk as a named human in state.md Accepted risks.
6. Mark the task done in `.eng-team/plan.md` with the date and the acceptance-check result.
7. Commits: in gated mode, ask once per project "May I commit after each task?" and record the answer in the Log. If allowed, commit the task's files with a message naming the task.
8. Repeat from step 1 until all tasks are done; then set the gate to `passed` (Evidence: plan.md) and `current_phase: test`.

## Exit criteria

- Every task in `.eng-team/plan.md` is marked done.
- Each task's acceptance check was run and observed passing by you, not only reported by the builder.
- No open Critical or High from the gate-mode reviews.

## Autonomous mode

Do not ask about commits; commit after each task. Hard stops still pause (a Critical finding always waits for the human): a Critical finding, a suite not fixed in 2 attempts, destructive operations, and actions outside the repository.
