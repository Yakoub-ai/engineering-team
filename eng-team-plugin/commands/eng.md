---
description: "eng-team: run the full lifecycle from the current phase (discover → research → architect → build → test → document → review)"
argument-hint: "[--autonomous|--gated] [what you want to build or change]"
---

Use the **eng-team** skill. If `.eng-team/state.md` is missing, run the init phase first (`phases/init.md`). Then resume from `current_phase` and continue phase by phase, honouring each phase's exit criteria, the autonomy level, hard stops and loop limits.

Arguments: $ARGUMENTS
- `--autonomous` / `--gated`: override `profile.autonomy` for this run.
- Any other text: the user's request; feed it to the discover phase.
