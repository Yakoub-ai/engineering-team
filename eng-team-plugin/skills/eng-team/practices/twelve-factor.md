---
id: twelve-factor
kind: practice
status: reviewed
tier: plugin
sources:
  - title: The Twelve-Factor App
    url: https://12factor.net/
    accessed: 2026-10-16
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.deploy_target != ""
---
# Practice pack: twelve-factor app

Applies to services deployed to a runtime target. Look in Dockerfiles, deploy manifests, CI/CD, config loading code, logging setup.

**Codebase, dependencies, config**
- One codebase per app tracked in version control, many deploys from it — [12factor I](https://12factor.net/)
- Dependencies are declared explicitly and isolated; no reliance on system-wide packages — [12factor II](https://12factor.net/)
- Config that varies between deploys lives in environment variables, not in code or committed files; no secrets in the repo — [12factor III](https://12factor.net/)

**Backing services, build/release/run**
- Databases, queues and caches are attached resources addressed by config, swappable without code change — [12factor IV](https://12factor.net/)
- Build, release and run are separate stages; releases are immutable and uniquely identified, so rollback is possible — [12factor V](https://12factor.net/)

**Processes and scaling**
- Processes are stateless and share nothing; persistent state lives in a backing service, not local disk or memory — [12factor VI](https://12factor.net/)
- The app is self-contained and exports services by port binding — [12factor VII](https://12factor.net/)
- Scale out via the process model (more processes), not bigger single processes — [12factor VIII](https://12factor.net/)
- Disposability: fast startup, graceful shutdown on SIGTERM, resilient to sudden death — [12factor IX](https://12factor.net/)

**Parity, logs, admin**
- Dev, staging and prod are kept as similar as possible; the same backing service types everywhere — [12factor X](https://12factor.net/)
- Logs are written as an unbuffered event stream to stdout; the app does not manage log files or routing — [12factor XI](https://12factor.net/)
- Admin and migration tasks run as one-off processes from the same release and config — [12factor XII](https://12factor.net/)

## Severity hints
Secrets committed in code or config files → Critical. State stored on local disk in a multi-instance deploy → High. No graceful shutdown or no rollback path → Medium. Dev/prod backing-service mismatch → Low.
