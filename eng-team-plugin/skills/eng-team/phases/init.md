# Phase 0: init

## Purpose

Scaffold `.eng-team/` in the target project: a filled profile (the scope contract) and a fresh state file. Ask the user only for what cannot be inferred.

## Inputs

- The repository contents: manifests (`package.json`, `pyproject.toml`, `go.mod`, …), IaC (`*.bicep`, `*.tf`, `cdk.json`), CI files, README, env samples (`.env.example`).
- `templates/profile.md` (field list, required/optional markers) and `templates/state.md`.
- The run's autonomy: what the user asked for in this command, else ask it as the `autonomy` field. Never set `autonomous` on your own: if the human is unavailable or says they cannot answer now, stay in the template's autonomy (default `gated`), ask the first question and stop. Only `--autonomous` or an explicit human instruction sets it.

## Steps

1. If `.eng-team/state.md` already exists, do not overwrite anything. Run the State integrity check from `shared/orchestration.md`, report the current phase and gate statuses, and stop.
2. Infer every profile field you can from the repo. After each inferred value add the trailing comment `# inferred: <file>`. Never guess a field the repo does not show.
3. For each `# required` field you could not infer, ask the user, one field per message, showing the template default as `(Recommended)` and one line on why it matters. Mark answered fields `# stated`. Accept "don't know" for `regulated.nis2_entity` as `unknown`.
4. `owner` is required. If the user cannot or does not answer it: set `owner: unassigned`, add an Open question `Q-n | Who owns this? | Accepted risks and approvals need a named human | init`, and add an Assumptions row `No accountable owner yet | low | an owner is named | agent`.
5. Write `.eng-team/profile.md` from `templates/profile.md` and `.eng-team/state.md` from `templates/state.md`. If `profile.md` already exists but `state.md` does not, keep `profile.md` and create `state.md` only. In state.md set `autonomy` to the profile value and `updated` to today (YYYY-MM-DD), and keep the Log line `- YYYY-MM-DD /eng-init — state created` with today's date.
6. Add the line `.eng-team/.cache/` to the repository `.gitignore` (create the file if missing; do not add it twice).
7. Show the profile to the user as one compact block. Say it is the scope contract and how to change it (edit `.eng-team/profile.md` or tell you).
8. Write the context snapshot `.eng-team/context.md` from `templates/context.md` following `shared/context.md`. Use what the snapshot or the repo scan already holds instead of scanning again. Then apply the CLAUDE.md integration from `shared/context.md` (write `CLAUDE.md` if missing, otherwise propose the merge).
9. **Transparency docs.** Write `docs/engineering/team-plan.md` from `templates/team-plan.md`, deciding each reviewer's on/off from the activation matrix in `shared/project-profile.md`; write `docs/engineering/STATUS.md` from `templates/status.md`; write `docs/engineering/questions.md` from `templates/questions.md`, mirroring state.md Open questions and Assumptions; open items init creates go to `docs/engineering/questions.md` for the next Gap review. Show the team plan to the human as a compact table (phase, agents, what you will be asked). In `gated` mode the human approves it together with the brief at discover.
10. Check the exit criteria other than the handover line. If they pass, follow Running a phase in `shared/orchestration.md`: write `docs/engineering/handovers/00-init.md`, rewrite STATUS.md and update the team plan (all showing init as passed), verify the handover and STATUS criterion, then set the init gate to `passed` with Evidence `.eng-team/profile.md`, and set `current_phase: discover`.

## Exit criteria

- Every `# required` field in `.eng-team/profile.md` has a non-empty value.
- `owner` is a name or role, or `unassigned` only when autonomy is `autonomous`; any other field may be `unknown` only when autonomy is `autonomous`, except a field whose enum includes `unknown` (currently `regulated.nis2_entity`), where `unknown` is always valid. In `gated` mode `unassigned`, or `unknown` in a field whose enum does not include it, fails the gate: ask again.
- `.eng-team/state.md` exists with all 8 gate rows.
- `.gitignore` contains `.eng-team/.cache/`.
- `docs/engineering/team-plan.md`, `docs/engineering/STATUS.md` and `docs/engineering/questions.md` exist.
- `.eng-team/context.md` exists, and `CLAUDE.md` holds the marked eng-team block or a merge proposal is awaiting approval (or recorded in `docs/engineering/questions.md` in autonomous mode).
- The handover `docs/engineering/handovers/00-init.md` exists and STATUS.md is current.

## Autonomous mode

Do not wait for answers. Fill each unanswered required field with a conservative default and record each one as an Assumptions row with Source `agent`:
- `stage: prototype`
- `criticality: important`
- `data_classes: [personal]`
- `jurisdictions: [eu]`
- `name`: the repository folder name.
- `summary`, `type`, `users`: derived from the user's request and the README.
- any other required field: its template default; `owner` per step 4.

If a field is still unknown after this, set it to the literal `unknown`, add an Open question for it and an Assumptions row (`<field> not known at init | low | the human states it | agent`).
