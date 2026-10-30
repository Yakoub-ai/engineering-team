---
description: "eng-team: join an existing project; a repo without eng-team is scanned, its stage inferred and an entry point recommended; a project eng-team already set up gets a read-only walkthrough for the person joining it"
argument-hint: "[--autonomous|--auto] [your goal or context]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory, where `phases/`, `shared/`, `roles/` and `templates/` live. Then run `phases/onboard.md`, following the skill's Preconditions, Autonomy and hard-stop rules.

If `.eng-team/state.md` already exists, the project is already set up and a person is joining it: do not onboard the repo again. Read `shared/project-walkthrough.md` from the skill base directory and follow it, then stop. It is read-only and logs nothing.

Arguments: $ARGUMENTS
- `--autonomous` / `--auto`: after you confirm (`shared/policy.md` → Activating autonomous mode), ask nothing more; record the context questions as assumptions.
- Any other text: your situation or goal (for example "we launch in 6 weeks and worry about security"); it answers the first context question.
