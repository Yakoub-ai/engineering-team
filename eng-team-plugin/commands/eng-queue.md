---
description: "eng-team: list destructive commands waiting for you, and mark one done or rejected after you act on it"
argument-hint: "[done <Q-id> [<Q-id> …] | reject <Q-id> [<Q-id> …]]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory. Then follow Approval queue in `shared/orchestration.md`.

Read `.eng-team/approvals/queue.jsonl` (later lines update earlier ones by `id`; a `pending` entry older than the policy's `approval_ttl_hours` counts as `expired`). Show one table: id, status, command, directory, reason, requested by, age. Under it, for each pending entry, the exact command in a code block for the user to copy, and what it unblocks.

Arguments: $ARGUMENTS
- none: list.
- `done <Q-id> …` / `reject <Q-id> …`: one verb and up to 20 ids separated by spaces, commas, `&` or `and` (e.g. `done Q-004 & Q-006`). The plugin's hook records this only when the user typed it, and records nothing if any part of the line is malformed. Mixed verbs need two commands.
- Every `/eng-queue` the user types also closes, as `done`, any entry whose command is a plain `rm` of literal paths inside the project that are already gone from disk. The hook checks the filesystem itself; you cannot mark anything. Re-read the queue and confirm each new status; for any id that did not change, say why (unknown, already closed, malformed line) and that the user must type the command themselves. Then resume per Approval queue → Resume.
