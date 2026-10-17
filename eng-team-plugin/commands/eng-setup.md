---
description: "eng-team: check, set up or update this project's environment (pinned toolchain, one-command setup, local services, pre-commit, CI security checks, dependency updates); installs on your machine are asked once, then done and verified"
argument-hint: "[check|install|update] [notes]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory, where `phases/`, `shared/`, `practices/` and `templates/` live. Then run `phases/setup.md`, following the skill's Preconditions, State integrity (`shared/orchestration.md`) and hard-stop rules, and Environment and tooling in `shared/orchestration.md`.

`/eng-setup` is standalone. It works on any project in any state, does not need `/eng-init`, and never changes gate statuses. When `.eng-team/state.md` exists it appends an `env:` Log line.

Arguments: $ARGUMENTS
- `check` (default): inventory and report what is missing, outdated or broken, with fixes.
- `install`: set the environment up: in-repo automation plus approved machine-level installs, verified from a clean state.
- `update`: update dependencies and tools in safe batches (security fixes first, majors one at a time), each verified by tests and a re-scan.
- Any other text: notes or scope.
