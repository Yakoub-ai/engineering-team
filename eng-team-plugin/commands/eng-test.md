---
description: "eng-team: run the test phase (see skills/eng-team/phases/test.md)"
argument-hint: "[--force] [--skip \"<reason>\"] [--autonomous|--gated] [notes]"
---

Use the **eng-team** skill. Run only the **test** phase as defined in `phases/test.md`, following the skill's Preconditions, State integrity and Autonomy rules.

Arguments: $ARGUMENTS
- `--force`: run even if an earlier gate is open; log `forced` with the reason in `.eng-team/state.md`.
- `--skip "<reason>"`: in gated mode, a human marks this phase `skipped` instead of running it; log the reason in `.eng-team/state.md`.
- `--autonomous` / `--gated`: override `profile.autonomy` for this run only.
- Any other text: extra context from the user for this phase.
