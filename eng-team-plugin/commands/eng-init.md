---
description: "eng-team: set up this project (creates .eng-team/profile.md and state.md)"
argument-hint: "[--autonomous] [project notes]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory, where `phases/`, `shared/` and `roles/` live. Then use it. Run only the **init** phase as defined in `phases/init.md`, following the skill's Preconditions, State integrity (`shared/orchestration.md`) and Autonomy rules.

Arguments: $ARGUMENTS
- `--autonomous`: set `profile.autonomy` to autonomous instead of asking.
- Any other text: extra context about the project, used to fill the profile.
