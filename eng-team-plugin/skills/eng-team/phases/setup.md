# Environment setup and updates (standalone)

## Purpose

Get any project, in any state, to a reproducible, automated, up-to-date environment that follows `practices/environment-setup.md`, and keep it there. The team does the work: it writes the in-repo automation, and it runs machine-level installs and updates after one approval, then verifies them.

Runs standalone via `/eng-setup`, works without `/eng-init`, and never changes gate statuses. In the lifecycle the same work is planned by the architect phase (environment and security-tooling tasks) and executed by build. When `.eng-team/state.md` exists, add the Log line `- YYYY-MM-DD env: <mode> <summary>`.

## Inputs

- The repository: manifests, lockfiles, version files, `Dockerfile`, `docker-compose*.yml`, `.devcontainer/`, CI workflows, `Makefile`/`justfile`, `.env.example`, `.pre-commit-config.yaml`, Dependabot/Renovate config.
- `.eng-team/profile.md` if present, else an in-memory profile (`phases/review.md` step 2).
- `practices/environment-setup.md`, `practices/secure-sdlc.md`, `phases/security-audit.md` step 3 (scanner list).

## Steps

1. **Mode.** `check` (default): report only. `install`: set up a fresh or broken environment. `update`: bring dependencies and tools up to date. If no mode is given, run `check` and recommend the next mode.
2. **Inventory** (all modes). Detect stacks and record, with evidence: required tools and their pinned versions vs. what is installed (`command -v`, `--version`); lockfile present and in sync; one-command setup present and working; `.env.example` completeness vs. keys the code reads; local services; pre-commit; CI workflows (tests, scans, pinned actions, permissions); dependency-update automation; outdated dependencies (`npm outdated`, `pip list --outdated` or `uv pip list --outdated`, `cargo outdated`, `go list -u -m all`) and known-vulnerable ones (osv-scanner if present).
3. **Report.** One table: item · status (ok / missing / outdated / broken) · evidence · fix · where it runs (repo or machine). Rank by the severity guidance in `practices/environment-setup.md`. In `check` mode stop here and offer `install` or `update`.
4. **In-repo automation** (`install`, `update`). Write or update, matching the project's existing conventions: version pins, task runner targets (`setup`, `test`, `lint`, `security`, `run`), `.env.example`, `docker-compose.yml` for local services, devcontainer when it pays off, pre-commit config, CI workflows (tests + static security layer, pinned actions, least-privilege permissions), Dependabot or Renovate config. With `.eng-team/state.md` and an active lifecycle, add these as plan tasks for `eng-builder` instead; standalone, dispatch `eng-builder` per change with an acceptance check.
5. **Machine-level installs** (`install`, `update`). Follow Environment and tooling in `shared/orchestration.md`: one consolidated command, one approval, then run it, verify every version, and log it. Never `sudo`, `curl | sh` or unofficial sources without a separate yes.
6. **Dependency updates** (`update`). Group patch/minor per ecosystem into one task; each major is its own task with release notes read and breaking changes listed. Security fixes first. After each task: frozen install, full test suite, static audit layer. A failure is reverted and reported; never leave the lockfile broken. Commits are local; never push.
7. **Verify.** Run the setup target from a clean state where feasible (fresh clone in a temp directory, or `make setup` twice to prove idempotence), then `test` and `security`. Record commands and results.

## Exit criteria

- The report table exists with evidence for every item.
- In `install`/`update`: the setup command succeeds from a clean state, the test suite is green, and the static security layer runs with one command.
- Every machine-level change was approved once, executed by the team and verified by version output.
- No secret was written to the repository; `.env` is gitignored.

## Autonomous mode

Run `check`, then do the in-repo automation and patch/minor updates without asking. Machine-level installs, `sudo`, majors that change public APIs, and anything outside the repository still ask the human.
