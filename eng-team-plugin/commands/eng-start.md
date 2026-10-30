---
description: "eng-team: guided first-run tour and environment check; teaches the modes, commands, safety rules and the present/view outputs; skippable at any step, changes nothing"
argument-hint: "[tour|check]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory. `/eng-start` is standalone and read-only: it works in any project in any state, writes nothing, and never changes gates, policy or autonomy.

Arguments: $ARGUMENTS
- `check`: only run step 1 and stop.
- `tour` or nothing: run step 1, then step 2.

Steps:

1. **Environment check.** Run `sh ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.sh` and show its output. For every `FAIL` line, give the fix it prints and do not run installs yourself (follow the Environment and tooling policy in `shared/orchestration.md`: show the exact command and ask once). `warn` lines are optional.
2. **Tour.** Read `shared/tour.md` from the skill base directory and follow it: pick the track that matches the project state, give one short card at a time, and after each card ask whether to continue, jump to a topic or skip the rest. If the user says skip, stop at once and give the three commands from the closing card.

Never present user-typed overrides, `--autonomous` or approvals as something Claude can do on its own; the tour explains that only the human can start them.
