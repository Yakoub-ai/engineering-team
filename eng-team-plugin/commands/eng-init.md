---
description: "eng-team: set up this project (creates .eng-team/profile.md and state.md)"
argument-hint: "[--autonomous|--auto] [project notes]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory, where `phases/`, `shared/` and `roles/` live. Then use it. Run only the **init** phase as defined in `phases/init.md`, following the skill's Preconditions, State integrity (`shared/orchestration.md`) and Autonomy rules.

Arguments: $ARGUMENTS
- `--autonomous` / `--auto`: offer autonomous mode instead of asking for the autonomy field; it starts only after you confirm and only if the policy written in this run allows it (`shared/policy.md`).
- Any other text: extra context about the project, used to fill the profile.
