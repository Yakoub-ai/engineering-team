---
description: "eng-team: run the full lifecycle from the current phase (discover → research → architect → build → test → document → review)"
argument-hint: "[--autonomous|--gated] [what you want to build or change]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory, where `phases/`, `shared/` and `roles/` live. Then use it. If `.eng-team/state.md` is missing, run the init phase first (`phases/init.md`). Then resume from `current_phase` and continue phase by phase, honouring each phase's exit criteria, the autonomy level, hard stops and loop limits.

Arguments: $ARGUMENTS
- `--autonomous` / `--gated`: override `profile.autonomy` for this run.
- Any other text: the user's request; feed it to the discover phase.
