# Phase 5: test

## Purpose

Prove the critical flows work, with tests that assert outcomes, and record the results for the document phase.

## Inputs

- `docs/brief.md`, `.eng-team/plan.md`, the code.
- `roles/tester.md`, `practices/testing-pyramid.md`, `templates/testing.md`.

## Steps

1. Dispatch `eng-tester` with `roles/tester.md`, the brief and the plan.
2. On `HARD-STOP:` (for example a suite not fixed in 2 attempts), follow Autonomy in `SKILL.md`. On `Status: BLOCKED`, resolve the question and re-dispatch.
3. On `Status: DONE`, re-run the suite yourself with the tester's run command. Compare pass, fail and skip counts with the tester's report; a mismatch or a test-code failure goes back to `eng-tester` (Loop counter `test→eng-tester`). A failure in production code loops back to the build phase per Loop-back in `SKILL.md` (Loop counter `test→build`): fix tasks `F<n>` run through build.md, including the gate-mode reviewer spot-check, then test re-runs.
4. Save the tester's flow → test table and run results to `.eng-team/test-results.md` with date and commit. The tester does not write `docs/testing.md`; `eng-tech-writer` writes it from this file in the document phase.
5. Set the gate to `passed` (Evidence: `.eng-team/test-results.md`) and `current_phase: document`.

## Exit criteria

- Every critical flow in the flow → test table has at least one test that asserts outcomes.
- The suite is green in your own run, and your counts match the recorded ones.
- `.eng-team/test-results.md` holds the table, the run command, date, commit and counts.

## Autonomous mode

Same steps. Hard stops still pause.
