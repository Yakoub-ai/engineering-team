---
description: "eng-team: tiered sweep for big jobs (audit fixes, refactors): Opus plans and signs off, Sonnet fixes each item in its own worktree, a separate verifier checks every fix; commits stay local"
argument-hint: "[audit|refactor] [--max-items N] [--max-parallel N] [paths or request]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory, where `phases/`, `shared/`, `roles/` and `templates/` live. Then run the sweep defined in `phases/sweep.md`, following the skill's Preconditions, State integrity (`shared/orchestration.md`) and hard-stop rules.

`/eng-sweep` is standalone: it needs an initialised project, never changes gate statuses, and appends only a `sweep:` Log line. It is for 8 or more independent items; for fewer, use `/eng-build` or `/eng-security-audit --fix`.

Arguments: $ARGUMENTS
- `audit` (default when a security report exists): fix the findings of the latest audit.
- `refactor`: apply the described change across the repo.
- `--max-items N` / `--max-parallel N`: proposed caps in the plan the human approves (parallel is limited to 6).
- Any other text: the request or paths that limit the scope.
