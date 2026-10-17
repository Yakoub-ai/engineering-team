---
id: environment-setup
kind: practice
status: reviewed
tier: plugin
sources:
  - title: Development Containers specification
    url: https://containers.dev/implementors/spec/
    accessed: 2026-10-17
  - title: mise (polyglot tool version manager) documentation
    url: https://mise.jdx.dev/
    accessed: 2026-10-17
  - title: pre-commit framework
    url: https://pre-commit.com/
    accessed: 2026-10-17
  - title: GitHub Dependabot version updates
    url: https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates
    accessed: 2026-10-17
  - title: Renovate documentation
    url: https://docs.renovatebot.com/
    accessed: 2026-10-17
  - title: GitHub Actions security hardening (pin actions to a full commit SHA)
    url: https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
    accessed: 2026-10-17
  - title: OpenSSF Scorecard checks
    url: https://github.com/ossf/scorecard/blob/main/docs/checks.md
    accessed: 2026-10-17
  - title: The Twelve-Factor App, II Dependencies and III Config
    url: https://12factor.net/
    accessed: 2026-10-17
reviewed_by: eng-team maintainers
review_by: 2027-04-17
applies_when: always
---

# Environment setup, automation and updates

**Reproducible toolchain**
- Pin language runtimes and CLI tools in the repo: `.tool-versions` or `mise.toml` (mise/asdf), `.nvmrc`, `.python-version`, `rust-toolchain.toml`, `go.mod` toolchain line. Source: mise docs.
- Declare every dependency with a committed lockfile; install with the frozen variant in CI (`npm ci`, `pnpm i --frozen-lockfile`, `uv sync --locked`, `poetry install --sync`, `cargo build --locked`). Source: Twelve-Factor II.
- Offer a devcontainer (`.devcontainer/devcontainer.json`) when the project has more than one runtime or system dependency, so local, Codespaces and CI match. Source: devcontainers spec.

**One-command workflows**
- A task runner (`Makefile`, `justfile`, `package.json` scripts, `mise tasks`) with at least `setup`, `test`, `lint`, `security`, `run`. `setup` is idempotent and checks tool versions. opinion: these five names are what new contributors look for.
- Config via environment: commit `.env.example` with safe test values and every key documented; `.env` is gitignored; secrets never in the repo. Source: Twelve-Factor III.
- Local services (DB, queue, cache) in `docker-compose.yml` with pinned image tags and seed data, so tests and DAST can run without cloud access.

**Guardrails before code reaches CI**
- pre-commit hooks: secret scan (gitleaks), formatter, linter, large-file and merge-conflict checks. Source: pre-commit docs.
- CI on every pull request: build, tests, the static audit layer from `phases/security-audit.md`, and a SBOM on release. Pin third-party actions to a full commit SHA and give workflows least-privilege `permissions:`. Source: GitHub Actions hardening; Scorecard Pinned-Dependencies and Token-Permissions.

**Updates**
- Automate dependency updates (Dependabot or Renovate) for packages, Docker base images and CI actions; group patch/minor, keep majors separate, and require the test suite and scans to pass. Source: Dependabot, Renovate docs; Scorecard Dependency-Update-Tool.
- Security updates for known-vulnerable dependencies are fixed ahead of feature work; target fix times by severity are set in `practices/secure-sdlc.md`.
- Toolchain updates (runtime versions) are deliberate plan tasks: read release notes, update the pin, run the full suite and the audit.
- opinion: never auto-merge majors; review the changelog for breaking changes and licence changes.

**Machine-level installs**
- Prefer the platform package manager (Homebrew, apt, winget) or the runtime manager over ad-hoc installers; avoid `curl | sh` unless it is the vendor's documented method and the user agreed after seeing it.
- Ask once per run with one consolidated command; after approval, run it and verify versions (`<tool> --version`). See Environment and tooling in `shared/orchestration.md`.

## Severity guidance
No lockfile or unpinned production dependencies → High (supply chain). Secrets in `.env` committed → Critical. No one-command setup or undocumented environment variables → Medium. No automated dependency updates on a production system → Medium. Unpinned CI actions → Medium. Missing devcontainer → Info.
