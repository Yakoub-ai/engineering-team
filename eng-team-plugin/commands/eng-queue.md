---
description: "eng-team: list commands waiting for your approval; approve one so Claude runs it once, or reject it"
argument-hint: "[approve <Q-id> … | reject <Q-id> … | done <Q-id> …]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory. Then follow Approval queue in `shared/orchestration.md`.

Read `.eng-team/approvals/queue.jsonl` (later lines update earlier ones by `id`; a `pending` entry older than the policy's `approval_ttl_hours` counts as `expired`). Show one table: id, status, command, directory, reason, requested by, age. Under it, for each pending entry, the exact command in a code block for the user to copy, and what it unblocks.

Arguments: $ARGUMENTS
- none: list.
- `approve <Q-id> …`: Claude may run each exact command once, from its directory, within 60 minutes. The user can also type `approve Q-<n>` (or `reject Q-<n>`) in any normal message. Then run it (or re-dispatch the agent that needs it) and report the result.
- `done <Q-id> …` / `reject <Q-id> …`: one verb and up to 20 ids separated by spaces, commas, `&` or `and` (e.g. `done Q-004 & Q-006`). The plugin's hook records this only when the user typed it, and records nothing if any part of the line is malformed. Mixed verbs need two commands.
- Every `/eng-queue` the user types also closes, as `done`, any entry the hook can verify: a plain `rm` of literal in-project paths that are gone, a single-branch delete whose branch is gone, or an agent-worktree cleanup with no agent worktrees or branches left. The orchestrator can run the same check with `node <plugin>/hooks/queue.js close`, and close one entry it checked itself with `node <plugin>/hooks/queue.js close Q-<n> --evidence "…"` (`by: agent-evidence`), except for entries flagged `needs_human_test`. Show that flag and `by` in the table. The hook checks the filesystem itself; you cannot mark anything. Re-read the queue and confirm each new status; for any id that did not change, say why (unknown, already closed, malformed line) and that the user must type the command themselves. Then resume per Approval queue → Resume.
