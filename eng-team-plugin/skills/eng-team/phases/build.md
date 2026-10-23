# Phase 4: build

## Purpose

Implement the approved plan. Independent tasks run in parallel, each in its own worktree; a task starts only when everything it depends on is verified. Each task is verified by you and spot-checked by reviewers before it counts.

## Inputs

- `docs/engineering/plans/plan.md`, ADRs in `docs/engineering/decisions/`, `docs/architecture.md`.
- Packs in use, `roles/builder.md`, `shared/findings.md`.

## Steps

**Task graph.** Approving the plan approves its tasks, `depends_on` and `files`; no further question is asked and the run continues by itself. Record the approved graph as the baseline. A task is `pending`, `running`, `verified` or `blocked`. Fix tasks `F<n>` from a loop-back join the graph with their own `files` and `depends_on`.

**Waves.** Repeat until every task is `verified`:
1. Pick every `pending` task whose dependencies are all `verified`. Drop any whose `files` overlap a task already picked or running. Take at most 3 (lean track: 2). One task left means the normal single flow; no worktree is needed.
2. Dispatch `eng-builder` per picked task, in parallel, with `isolation: worktree`, `Task: <id>`, `roles/builder.md`, that task only (plus the ADRs it cites and the packs in use) and "commit locally in your worktree, never push; write only the paths in `files`".
3. On `Status: BLOCKED`, answer the question (ask the user if needed) and re-dispatch. On `HARD-STOP:` or an `eng-team guard:` denial, follow the Hard-stop procedure in `shared/orchestration.md`, logging `hard-stop build: <reason>`; other running tasks finish but nothing merges until the human decides.
4. On `Status: DONE`, check the scope yourself: `git diff --name-only` of the worktree branch against the task's `files`. Any path outside `files` is a **deviation** (see Deviations in `shared/orchestration.md`); do not merge that task.
5. Run the task's acceptance check in its worktree and read the output; never trust the report. A failed check goes back to the builder (Loop counter `build:<task id>→eng-builder`; at count 2 run the Diagnosis handover in `shared/orchestration.md` before the last attempt).
6. Reviewers have no Bash, so you produce the diff: write the task's diff to `${TMPDIR:-/tmp}/eng-team-<YYYY-MM-DD>/diff-<task id>.patch` (outside the repo) and pass that absolute path plus the changed-file list. Dispatch the reviewer roles listed on the plan task in `gate` mode (lean track: `eng-security-engineer` only), in parallel across tasks. If secret or SAST scanners are installed, run them on the changed files first (`phases/security-audit.md` step 3; raw output outside the repo) and give the output to `eng-security-engineer`.
7. A High finding goes back to `eng-builder` with the finding (same Loop counter; at count 2, the Diagnosis handover first). At count 3, escalate to the human. A Critical finding (after the severity cap) never loops automatically: set the gate to `failed`, log it, and ask the human in every mode to choose fix (re-dispatch the builder) or accept the risk as a named human in state.md Accepted risks.
8. **Merge serially**, in plan order: bring each passed task onto the working branch (cherry-pick its commit) and re-run its acceptance check, plus the checks of the tasks already merged that share a dependency. A conflict or a failure after the merge sends the task back to its builder against the new head and counts as an attempt; never resolve a conflict by guessing. Only now is the task `verified`: mark it done in `docs/engineering/plans/plan.md` with the date and the acceptance-check result. Remove its worktree.
9. A task that cannot be verified (hard stop, count 3, deviation, rejected risk) stops its dependents: mark them `blocked`, never start them. Independent tasks continue. Tell the human at once (Deviations); do not wait until the end.
10. Commits: in gated mode, ask once per project "May I commit after each task?" and record the answer in the Log. If allowed, the merged commit stays on the working branch; if not, the merge is applied uncommitted and tasks run one at a time. Never push, open PRs or change remotes; commits are local.
11. When every task is `verified`, set the gate to `passed` via Running a phase in `shared/orchestration.md` (handover, STATUS, team plan first) (Evidence: `docs/engineering/plans/plan.md`) and `current_phase: test`.

## Exit criteria

- Every task in `docs/engineering/plans/plan.md` is marked done, and every task started only after its dependencies were verified.
- No task wrote outside its `files`, and no deviation is open.
- Each task's acceptance check was run and observed passing by you, not only reported by the builder, again after it was merged.
- No open Critical or High from the gate-mode reviews.
- The handover `docs/engineering/handovers/04-build.md` exists and STATUS.md is current.

## Autonomous mode

Do not ask about commits; commit after each merged task. Deviations still stop and notify the human. Hard stops still pause per the Hard-stop procedure in `shared/orchestration.md` (a Critical finding always waits for the human): a Critical finding, a suite not fixed in 2 attempts, destructive operations, and actions outside the repository.
