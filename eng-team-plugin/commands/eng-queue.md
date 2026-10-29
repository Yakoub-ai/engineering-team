---
description: "eng-team: list destructive commands waiting for you, and mark one done or rejected after you act on it"
argument-hint: "[done <Q-id> | reject <Q-id>]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory. Then follow Approval queue in `shared/orchestration.md`.

Read `.eng-team/approvals/queue.jsonl` (later lines update earlier ones by `id`; a `pending` entry older than the policy's `approval_ttl_hours` counts as `expired`). Show one table: id, status, command, directory, reason, requested by, age. Under it, for each pending entry, the exact command in a code block for the user to copy, and what it unblocks.

Arguments: $ARGUMENTS
- none: list.
- `done <Q-id>` / `reject <Q-id>`: the plugin's hook records this only when the user typed it. Re-read the queue and confirm the new status; if it did not change, say the user must type the command themselves. Then resume per Approval queue → Resume.
