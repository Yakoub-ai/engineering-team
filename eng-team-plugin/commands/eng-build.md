---
description: "eng-team: run the build phase (see skills/eng-team/phases/build.md)"
argument-hint: "[--force] [--skip \"<reason>\"] [--autonomous|--gated] [notes]"
---

Use the **eng-team** skill. Run only the **build** phase as defined in `phases/build.md`, following the skill's Preconditions, State integrity and Autonomy rules.

Arguments: $ARGUMENTS
- `--force`: run even if an earlier gate is open; log `forced` with the reason in `.eng-team/state.md`.
- `--skip "<reason>"`: in gated mode, a human marks this phase `skipped` instead of running it; log the reason in `.eng-team/state.md`.
- `--autonomous` / `--gated`: override `profile.autonomy` for this run only.
- Any other text: extra context from the user for this phase.
