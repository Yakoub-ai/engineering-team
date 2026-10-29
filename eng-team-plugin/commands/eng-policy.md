---
description: "eng-team: view or change this repo's security policy (.eng-team/policy.json); only you can run it"
argument-hint: "[what to change, e.g. \"allow autonomous\" or \"block make reset-db\"]"
disable-model-invocation: true
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory. Then follow `shared/policy.md`.

Typing this command opens a 30-minute window in which the guard lets you edit `.eng-team/policy.json`. If the file does not exist, run Setup from `shared/policy.md`. Otherwise show the current policy as a short table, apply the change in the arguments (ask what to change if there are none), and show the diff before and after the edit. Loosening changes make Claude Code ask the user to confirm.

Arguments: $ARGUMENTS
