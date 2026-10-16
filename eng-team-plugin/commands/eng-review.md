---
description: "eng-team: review/audit this repo, PR or design (v1 review & gate modes)"
argument-hint: "[plan|review|gate] [paths or diff range]"
---

Use the **eng-team** skill. Run the **review** phase as defined in `phases/review.md`, following the skill's Preconditions and State integrity rules.

`/eng-review` invoked directly is a standalone review. It works without `/eng-init` (state is optional), never changes gate statuses, and when `.eng-team/state.md` exists it only appends an `adhoc-review:` Log line.

Arguments: $ARGUMENTS
- `plan` / `review` / `gate`: the review mode to run.
- Any other text: paths or a diff range to scope the review.
