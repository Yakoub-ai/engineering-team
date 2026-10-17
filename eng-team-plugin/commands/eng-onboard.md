---
description: "eng-team: join an existing project in any state; scans code, docs and history, infers the stage and lifecycle position, asks for your current context, and recommends where to start"
argument-hint: "[--autonomous] [your goal or context]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory, where `phases/`, `shared/`, `roles/` and `templates/` live. Then run `phases/onboard.md`, following the skill's Preconditions, Autonomy and hard-stop rules.

If `.eng-team/state.md` already exists, do not onboard again: run the State integrity check, report the current phase and gate statuses, and stop.

Arguments: $ARGUMENTS
- `--autonomous`: ask nothing; record the context questions as assumptions.
- Any other text: your situation or goal (for example "we launch in 6 weeks and worry about security"); it answers the first context question.
