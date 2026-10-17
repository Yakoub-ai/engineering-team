# Phase 5: test

## Purpose

Prove the critical flows work, with tests that assert outcomes, and record the results for the document phase.

## Inputs

- `docs/engineering/product/brief.md`, `docs/engineering/plans/plan.md`, the code.
- `roles/tester.md`, `practices/testing-pyramid.md`, `templates/testing.md`.
- `phases/security-audit.md`, `profile.security_testing`.

## Steps

1. Dispatch `eng-tester` with `roles/tester.md`, the brief and the plan.
2. On `HARD-STOP:` (for example a suite not fixed in 2 attempts), follow the Hard-stop procedure in `shared/orchestration.md`. On `Status: BLOCKED`, resolve the question and re-dispatch.
3. On `Status: DONE`, re-run the suite yourself with the tester's run command. Compare pass, fail and skip counts with the tester's report; a mismatch or a test-code failure goes back to `eng-tester` (Loop counter `test→eng-tester`). A failure in production code loops back to the build phase per Loop-back in `shared/orchestration.md` (Loop counter `test→build`): fix tasks `F<n>` run through build.md, including the gate-mode reviewer spot-check, then test re-runs.
4. **Security audit.** Once the suite is green, run `phases/security-audit.md` as part of this phase, not standalone. Mode: `full` when `profile.security_testing.dast_target` is `local` or a URL, or is `auto` and the app starts locally; otherwise `static`, with the reason recorded. Critical/High findings become fix tasks via Loop-back in `shared/orchestration.md` (Loop counter `test→build`); a Critical follows Critical findings there. Add a row to state.md Security audits (Trigger `lifecycle-test`, Next due per Continuous security testing in `shared/orchestration.md`).
5. Save the tester's flow → test table and run results to `.eng-team/test-results.md` with date and commit, plus the audit summary (mode, commit, counts, report path). The tester does not write `docs/testing.md`; `eng-tech-writer` writes it from this file in the document phase.
6. Set the gate to `passed` (Evidence: `.eng-team/test-results.md`) and `current_phase: document`.

## Exit criteria

- Every critical flow in the flow → test table has at least one test that asserts outcomes.
- The suite is green in your own run, and your counts match the recorded ones.
- `.eng-team/test-results.md` holds the table, the run command, date, commit and counts.
- A security audit report for the tested commit exists in `docs/security/`, state.md Security audits has its row, and no Critical/High from it is open (or each is an Accepted risk signed by a human).

## Autonomous mode

Same steps. Hard stops still pause per the Hard-stop procedure in `shared/orchestration.md` (log `hard-stop test: <reason>`).
