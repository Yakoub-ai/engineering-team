---
description: "eng-team: set up this project (creates .eng-team/profile.md and state.md)"
argument-hint: "[--autonomous] [project notes]"
---

Use the **eng-team** skill. Run only the **init** phase as defined in `phases/init.md`, following the skill's Preconditions, State integrity and Autonomy rules.

Arguments: $ARGUMENTS
- `--autonomous`: set `profile.autonomy` to autonomous instead of asking.
- Any other text: extra context about the project, used to fill the profile.
