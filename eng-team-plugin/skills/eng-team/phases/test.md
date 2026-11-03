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
3. On `Status: DONE`, check the tester's scope first: `git diff --name-only` against the commit the phase started from. The tester owns tests, fixtures, test config and CI test steps only; any other changed path (production code, dependency manifests or lockfiles, build scripts) is a **deviation** (Deviations in `shared/orchestration.md`): do not use that run until the human decides; a production bug goes through the build loop-back below, never through the tester. Then gate the test diff like a build task: write it to `${TMPDIR:-/tmp}/eng-team-<YYYY-MM-DD>/diff-test-<n>.patch` and dispatch `eng-security-engineer` and `eng-code-hygiene` in `gate` mode in parallel (`Task: gate-test-<n>`, `hygiene-test-<n>`), with the verifier and fix rules of build step 7. Then re-run the suite yourself with the tester's run command. Compare pass, fail and skip counts with the tester's report; a mismatch or a test-code failure goes back to `eng-tester` (Loop counter `test→eng-tester`). A failure in production code loops back to the build phase per Loop-back in `shared/orchestration.md` (Loop counter `test→build`): fix tasks `F<n>` run through build.md, including the gate-mode reviewer spot-check, then test re-runs.
4. **Security audit.** Once the suite is green, run `phases/security-audit.md` as part of this phase, not standalone. Mode: `full` when `profile.security_testing.dast_target` is `local` or a URL, or is `auto` and the app starts locally; otherwise `static`, with the reason recorded. Critical/High findings, and Medium findings and failing flows, become fix tasks per Auto-fix of non-critical findings in `shared/orchestration.md` (Loop counter `test→build`); a Critical follows Critical findings there. Add a row to state.md Security audits (Trigger `lifecycle-test`, Next due per Continuous security testing in `shared/orchestration.md`).
5. **Run it live.** Unit and integration tests are not enough. Start the app locally the way a developer would (dev server, `docker compose up`, the CLI, a local function emulator), never against prod or with prod credentials. Exercise every critical flow end to end: HTTP calls with `curl`, the UI with Playwright when it is installed (screenshots outside the repo), or the CLI with real arguments. While it runs, read the server output, the browser console and any log files, and treat errors, unhandled rejections and stack traces as failures even when the flow looked fine. Stop every process you started. Each result goes in Verified as `command` → what you observed. A failure is a production-code failure (step 3's loop-back).
6. **Human test steps.** For anything you could not check yourself (real devices, third-party sandboxes or payments, email or SMS delivery, visual or UX judgement, anything needing credentials you do not have), write numbered steps the user can follow: the exact command to start it, the URL or input, what they should see, which log to watch and what an error there looks like. Put them in the receipt under Not verified and in the handover. Never mark such a flow as verified.
7. Save the tester's flow → test table and run results to `.eng-team/test-results.md` with date and commit, plus the audit summary (mode, commit, counts, report path). The tester does not write `docs/testing.md`; `eng-tech-writer` writes it from this file in the document phase.
8. Set the gate to `passed` via Running a phase in `shared/orchestration.md` (handover, STATUS, team plan first) (Evidence: `.eng-team/test-results.md`) and `current_phase: document`.

## Exit criteria

- Every critical flow in the flow → test table has at least one test that asserts outcomes.
- The tester's diff touched only test paths and was gated by `eng-security-engineer` and `eng-code-hygiene` with no open Critical/High and no upheld Medium.
- The suite is green in your own run, and your counts match the recorded ones.
- Every critical flow was run live and its logs read, or is listed with numbered human test steps and the reason it could not be run.
- `.eng-team/test-results.md` holds the table, the run command, date, commit and counts.
- A security audit report for the tested commit exists in `docs/security/`, state.md Security audits has its row, and no Critical/High from it is open (or each is an Accepted risk signed by a human).
- The handover `docs/engineering/handovers/05-test.md` exists and STATUS.md is current.

## Autonomous mode

Same steps. Hard stops still pause per the Hard-stop procedure in `shared/orchestration.md` (log `hard-stop test: <reason>`).
