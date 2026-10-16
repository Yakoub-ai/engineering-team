---
description: "eng-team: run the research phase (see skills/eng-team/phases/research.md)"
argument-hint: "[--force \"<reason>\"] [--skip \"<reason>\"] [--autonomous|--gated] [notes]"
---

Use the **eng-team** skill. Run only the **research** phase as defined in `phases/research.md`, following the skill's Preconditions, State integrity and Autonomy rules.

Arguments: $ARGUMENTS
- `--force "<reason>"`: run anyway even if an earlier gate is open; the reason is the quoted argument. Set each earlier gate that is not `passed|skipped` to `forced` and log `- YYYY-MM-DD forced research: <reason>` in `.eng-team/state.md`.
- `--skip "<reason>"`: in gated mode, a human marks this phase `skipped` instead of running it; log the reason in `.eng-team/state.md`.
- `--autonomous` / `--gated`: override `profile.autonomy` for this run only.
- Any other text: extra context from the user for this phase.
