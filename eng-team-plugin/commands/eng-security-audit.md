---
description: "eng-team: deep, tool-backed security audit of any repo (static, DAST on a locally running app, or full) with a findings report, regulation mapping and remediation plan; optional --fix; never changes lifecycle gates"
argument-hint: "[auto|static|dast|full] [--target <url>] [--fix] [paths]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory, where `phases/`, `shared/`, `roles/` and `templates/` live. Then run the security audit defined in `phases/security-audit.md`, following the skill's Preconditions, State integrity (`shared/orchestration.md`) and hard-stop rules.

`/eng-security-audit` is standalone. It works on any project, whether or not eng-team built it, and does not need `/eng-init`. It never changes gate statuses, and when `.eng-team/state.md` exists it only appends a `security-audit:` Log line.

Arguments: $ARGUMENTS
- `auto` (default): inspect the repo, recommend `static`, `dast` or `full` with a one-line reason, and let the human choose.
- `static`: SAST, secrets (including git history), dependencies, IaC, containers and SBOM, plus AI review.
- `dast`: start the app locally and scan it live (passive, active, API, targeted probes). Use `--target <url>` for a non-production URL you are authorised to test; this always asks for written confirmation first.
- `full`: static, then DAST, with findings correlated.
- `--fix`: after the report, execute the remediation plan task by task (builder, then tester, then re-scan). Critical findings still ask first.
- Any other text: paths that limit the scope.
