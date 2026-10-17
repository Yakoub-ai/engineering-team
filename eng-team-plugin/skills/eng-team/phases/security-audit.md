# Security audit (standalone, tool-backed)

## Purpose

Deep security test of whatever is in the repository, whether or not eng-team built it. Real scanners find, specialist agents triage: every tool finding is checked against the code, false positives are dropped, logic flaws the tools cannot see are added, and each finding is mapped to the regulation it touches. The output is a findings report, a fix for each finding, and an ordered remediation plan that can be executed and re-verified.

It runs in two ways:
- **In the lifecycle**: the test phase (`phases/test.md` step 4) and the review phase run it; findings loop back to build like any other, and each run adds a row to state.md Security audits.
- **Standalone** (`/eng-security-audit`): works without `/eng-init` and never changes gate statuses by itself. When `.eng-team/state.md` exists it adds a Security audits row (Trigger `adhoc` or `scheduled`) and the Log line `- YYYY-MM-DD security-audit: <mode> <scope>`. Only `--fix` on an initialised project changes gates, through Loop-back (see step 9).

## Inputs

- The repository (or the paths given as scope).
- `.eng-team/profile.md` if present; otherwise an in-memory profile built as in `phases/review.md` step 2.
- `shared/findings.md` (finding format, severity, status), `roles/security-engineer.md`, `roles/compliance-officer.md`, `practices/secure-sdlc.md`, and the compliance packs whose `applies_when` match the profile.
- `templates/security-report.md` and `templates/remediation-plan.md`.
- For DAST: a runnable application (local or containerised) or a non-production URL the human confirms they are authorised to test.

## Steps

1. **Choose the mode, with advice.** Start from `profile.security_testing.dast_target` when it is set (`none` → `static`; `local` or a URL → `full`). Otherwise read the repo first (manifests, `Dockerfile`, `docker-compose*.yml`, `Procfile`, `package.json` scripts, `Makefile`, OpenAPI/GraphQL schemas, IaC), then recommend a mode with one line of reasoning and let the human choose. If the human is away, use the recommendation.

   | Mode | What runs | Recommend when |
   |---|---|---|
   | `static` | SAST, secrets (working tree + git history), dependencies (SCA), IaC, container images, licences, AI review | No runnable app (library, IaC-only, data pipeline, CLI); app needs cloud services or secrets you do not have; PR/diff checks; first look at an unknown repo |
   | `dast` | Starts the app locally, then passive baseline scan, active scan of a disposable instance, API scan from the schema, header/cookie/CORS/TLS/authZ probes | Web app or API that starts locally (compose, dev server, container) and static was already run recently |
   | `full` | `static`, then `dast`, with findings correlated (a static finding confirmed at runtime is raised to `confirmed`) | Pre-launch, pre-production, after major changes, or regulated profiles (`regulated.*` true, `criticality` high). Default recommendation whenever the app can run locally |

   Advice rules: never recommend DAST against production; recommend `full` before a `stage` change to production; for a `prototype` say `static` is usually enough; if the app cannot start without secrets, recommend `static` now and list what a DAST run would need (a `.env.example` with test values, seed data, a test user).

2. **Profile.** Use `.eng-team/profile.md` or build the in-memory profile (`phases/review.md` step 2; do not write `.eng-team/`). Activate roles with `shared/project-profile.md`; `security-engineer` and `compliance-officer` are always on for this audit, plus `data-engineer`, `ai-engineer`, `platform-engineer` when their triggers match.

3. **Tool inventory.** Check which scanners exist (`command -v <tool>`, with versions) and whether `docker` is available. For missing tools, follow Environment and tooling in `shared/orchestration.md`: ask once, with one consolidated command (for example `brew install semgrep gitleaks osv-scanner trivy syft && docker pull ghcr.io/zaproxy/zaproxy:stable`); on approval run it yourself and verify each version; on refusal continue with what exists. Then offer to make the tooling reproducible in the repo (a `make security` or `just security` target, pre-commit hooks, a CI workflow) per `practices/environment-setup.md`. Preferred tools, by layer:

   | Layer | Preferred | Fallbacks |
   |---|---|---|
   | SAST | `semgrep scan --config p/default --config p/owasp-top-ten --sarif` | `bandit` (Python), `gosec` (Go), `brakeman` (Rails), CodeQL if configured in CI |
   | Secrets | `gitleaks git --redact --report-format sarif` (full history) | `trufflehog git file://. --only-verified` |
   | Dependencies | `osv-scanner scan source -r . --format sarif` | `npm audit --json`, `pip-audit -f json`, `cargo audit --json`, `govulncheck ./...` |
   | IaC / config | `trivy config .` and `checkov -d . -o sarif` | `tfsec`, `kube-linter`, `hadolint` for Dockerfiles |
   | Containers / SBOM | `trivy image <built image>`, `syft . -o cyclonedx-json` | `grype` |
   | DAST | OWASP ZAP in Docker: `zap-baseline.py`, `zap-full-scan.py`, `zap-api-scan.py` | `nuclei -as` on local targets, `testssl.sh` for TLS on staging |

   Write every raw output to a temporary directory outside the repo (`${TMPDIR:-/tmp}/eng-security-audit-<YYYY-MM-DD>/`), never into the repo: raw outputs can contain secrets. Where no tool exists for a layer, the AI review in step 6 covers it manually and the report states the layer was `reviewed-manually` (lower confidence) rather than `scanned`.

4. **Static layer** (`static`, `full`). Run each available tool on the scope, with a timeout, and record the exact command, tool version and exit code. Build the app's container image only if the repo has a `Dockerfile` and docker is available. Generate a CycloneDX SBOM when `syft` or `trivy` exists. A tool that fails is reported in Coverage with its error; never treat a failed run as "no findings".

5. **DAST layer** (`dast`, `full`). Authorisation and safety come first:
   - Allowed without further confirmation once the human chose this mode: targets on `localhost`, `127.0.0.1` or a docker network the audit started itself.
   - Any other URL: follow the Hard-stop procedure in `shared/orchestration.md` (label `HARD STOP (security-audit): DAST against <url> needs authorisation`) and ask the human to confirm in writing that they own or are authorised to test it and that it is not production. Production targets are refused; recommend a staging copy.
   - Active scanning writes data and can break things: run it only against a disposable instance with seed/test data, never with production data or production credentials.
   Then:
   1. Start the app the way the repo documents it (`docker compose up -d`, `npm run dev`, `make run`, ...), with a `.env` built from `.env.example` test values. If it needs secrets you do not have, ask once; otherwise fall back to `static` and say why.
   2. Health-check until it responds (max ~2 minutes). Record the start command.
   3. Passive baseline: `zap-baseline.py -t <url>`. Then active: `zap-full-scan.py` (web) or `zap-api-scan.py -f openapi|graphql` when a schema exists. If the human supplied test-user credentials, run authenticated (ZAP context or header injection); otherwise state that authenticated surfaces were not exercised.
   4. Targeted probes with `curl`: security headers (CSP, HSTS, X-Content-Type-Options, frame-ancestors), cookie flags (`Secure`, `HttpOnly`, `SameSite`), CORS with a hostile `Origin`, verbose errors and stack traces, debug endpoints, rate limiting on login, and, with two test users, IDOR/tenant isolation on object IDs.
   5. Stop everything the audit started (`docker compose down`, kill the dev server) and confirm the ports are free. Leave no containers, volumes or test data behind except what the human asks to keep.

6. **AI triage and deep review.** Dispatch `eng-security-engineer` (and the other activated reviewers) per `SKILL.md` → Dispatching agents, in `review` mode, giving them the raw-output directory and the coverage table. Instruct them to: (a) open each tool finding at its `path:line` and mark it `confirmed`, `suspected` or false positive (with the reason); (b) dedupe across tools (same root cause → one finding listing every source); (c) look for what scanners miss — broken authorisation, tenant isolation, business-logic abuse, insecure defaults, missing controls, prompt injection in AI features, personal data in logs; (d) attach a code-level fix to every finding; (e) map each finding to its regulation via the matching packs (for example GDPR Art. 32, NIS2 Art. 21(2), DORA Art. 9, AI Act Art. 15). Each finding adds a `Source:` line: `tool:<name> <rule-id>` or `manual`, and `dast` when confirmed at runtime.

7. **Consolidate.** As in `phases/review.md` step 5: dedupe, re-open the evidence for every Critical/High, apply the unreviewed-pack severity cap, rank by severity then effort. In `full` mode, a static finding reproduced by DAST becomes `confirmed`; a DAST-only finding is traced to its `path:line` where possible.

8. **Report and plan.** Write `docs/security/security-audit-<YYYY-MM-DD>.md` from `templates/security-report.md` and `docs/security/remediation-plan-<YYYY-MM-DD>.md` from `templates/remediation-plan.md`. Every plan task names the finding IDs it closes, the fix, the files, an acceptance check that re-runs the exact tool rule or probe that found it, and a regression test. Human-only actions (rotating a leaked secret, purging git history, changing cloud settings, notifying a regulator) are separate tasks marked `owner: human` with a deadline. If a personal-data breach may have occurred (e.g. a leaked production credential), say that GDPR Art. 33 gives 72 hours to notify the supervisory authority once the controller is aware, and that the controller decides.

9. **Fix (only when asked).** If the human passes `--fix` or approves the plan: for each task in plan order, dispatch `eng-builder` with the task, then `eng-tester` for the regression test, then re-run the acceptance check. Mark the task `verified` with the command output, or `failed` after 2 attempts (hard stop 7(b)). Commits are local; never push. With `.eng-team/state.md` and an active lifecycle, add the tasks to the plan via Loop-back in `shared/orchestration.md` instead of fixing outside the lifecycle. Critical findings follow Critical findings in `shared/orchestration.md`: ask the human before fixing.

10. **Re-scan.** After fixes, re-run the layers that produced the closed findings and append a "Re-scan" section to the report with before/after counts.

## Exit criteria

- The report exists with Coverage (every layer: `scanned`, `reviewed-manually`, or `not-run` with the reason), Findings, Needs evidence and Not covered sections.
- Every finding has evidence (`path:line`, URL + request, or tool rule + location), a `Source:` line, a fix and, where one applies, a regulation reference.
- The remediation plan exists, and every Critical and High finding is covered by a task.
- Anything the DAST layer started has been stopped; no raw output or secret was written into the repository.
- With `.eng-team/state.md`: a Security audits row and a Log line were added; gate statuses changed only through the test/review phases or `--fix` Loop-back.

## Autonomous mode

Pick the recommended mode without asking, but never scan a non-local target, use real credentials, or fix a Critical finding without the human; those still stop and ask. Installing tools and pulling images are still asked once per run (Environment and tooling in `shared/orchestration.md`). Fix only High and lower when `--fix` was given, and record `Decided by: agent` for each mode choice in the report header.
