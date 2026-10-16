# Phase 0: init

## Purpose

Scaffold `.eng-team/` in the target project: a filled profile (the scope contract) and a fresh state file. Ask the user only for what cannot be inferred.

## Inputs

- The repository contents: manifests (`package.json`, `pyproject.toml`, `go.mod`, …), IaC (`*.bicep`, `*.tf`, `cdk.json`), CI files, README, env samples (`.env.example`).
- `templates/profile.md` (field list, required/optional markers) and `templates/state.md`.
- The run's autonomy: what the user asked for in this command, else ask it as the `autonomy` field.

## Steps

1. If `.eng-team/state.md` already exists, do not overwrite anything. Run the State integrity check from `shared/orchestration.md`, report the current phase and gate statuses, and stop.
2. Infer every profile field you can from the repo. After each inferred value add the trailing comment `# inferred: <file>`. Never guess a field the repo does not show.
3. For each `# required` field you could not infer, ask the user, one field per message, showing the template default as `(Recommended)` and one line on why it matters. Mark answered fields `# stated`. Accept "don't know" for `regulated.nis2_entity` as `unknown`.
4. `owner` is required. If the user cannot or does not answer it: set `owner: unassigned`, add an Open question `Q-n | Who owns this? | Accepted risks and approvals need a named human | init`, and add an Assumptions row `No accountable owner yet | low | an owner is named | agent`.
5. Write `.eng-team/profile.md` from `templates/profile.md` and `.eng-team/state.md` from `templates/state.md`. If `profile.md` already exists but `state.md` does not, keep `profile.md` and create `state.md` only. In state.md set `autonomy` to the profile value and `updated` to today (YYYY-MM-DD), and keep the Log line `- YYYY-MM-DD /eng-init — state created` with today's date.
6. Add the line `.eng-team/.cache/` to the repository `.gitignore` (create the file if missing; do not add it twice).
7. Show the profile to the user as one compact block. Say it is the scope contract and how to change it (edit `.eng-team/profile.md` or tell you).
8. Check the exit criteria. If they pass, set the init gate to `passed` with Evidence `.eng-team/profile.md`, and set `current_phase: discover`.

## Exit criteria

- Every `# required` field in `.eng-team/profile.md` has a non-empty value.
- `owner` is a name or role, or `unassigned` only when autonomy is `autonomous`; any other field may be `unknown` only when autonomy is `autonomous`, except a field whose enum includes `unknown` (currently `regulated.nis2_entity`), where `unknown` is always valid. In `gated` mode `unassigned`, or `unknown` in a field whose enum does not include it, fails the gate: ask again.
- `.eng-team/state.md` exists with all 8 gate rows.
- `.gitignore` contains `.eng-team/.cache/`.

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
