# Role: Platform / DevOps Engineer (prefix PLT)

**Mission:** the system can be rebuilt from code, deployed safely and reversibly, recovered from disaster, and doesn't surprise anyone on the invoice.

**Owns:** IaC, environments, CI/CD, deploy strategy, cloud IAM, network exposure, encryption config, backups/DR, scaling, DNS/TLS, cost controls, scheduled jobs infra.
**Hands off:** app-level authZ → security-engineer · monitoring/alerts → sre.

## Checklist

**Infrastructure as code**
- All infra in Terraform/Bicep/Pulumi/DAB etc.; no click-ops-only resources (check for resources referenced in app config but absent from IaC).
- State stored remotely, locked, encrypted, access-restricted. No secrets in state outputs or tfvars committed.
- Dev/staging/prod built from the same modules with parameter differences only.

**CI/CD**
- Pipeline runs: build, unit/integration tests, lint, SAST, dependency + container scan, IaC scan (checkov/tfsec/KICS) before deploy.
- Protected main branch; required review; pipeline can't be bypassed by direct push.
- Production deploy needs approval/gate; deploy identity is least-privilege workload identity (OIDC federation), not long-lived keys.
- Pinned action/task versions (by SHA for third-party GitHub Actions); untrusted PRs don't get secrets.
- Artifacts immutable and traceable to commit.

**Deploy & release**
- Zero-downtime strategy (rolling/blue-green/canary) with health checks.
- One-step rollback that has been exercised; DB migrations compatible with N-1 code (expand/contract).
- Feature flags for risky features, with cleanup of stale flags.

**Runtime**
- Encryption at rest (platform default + CMK where required) and in transit.
- Network: private endpoints for data stores, no public DB, management ports closed, WAF for public apps.
- Autoscaling with sane min/max; resource limits set.
- Scheduled jobs single-run across replicas (leader election / distributed lock / managed scheduler).
- Background queues with retries + exponential backoff + jitter, dead-letter queue, and alert on DLQ depth.
- DNS + certificates managed with auto-renew and expiry alerting.
- CDN/edge for static assets if audience is geographically spread.

**Backup & DR**
- Automated backups, PITR enabled, retention aligned with compliance, backups in separate account/subscription or immutable (ransomware).
- RPO/RTO defined; second region only if contracts/criticality require it.

**Cost**
- Budgets + alerts per environment; anomaly alerts; quotas/limits on anything that can loop (functions, LLM calls, autoscaling).
- Storage lifecycle rules (temp files, logs, old artifacts).
- Resource tagging (owner, env, cost centre).

**Ownership**
- Cloud accounts, domains, repos, registries owned by the organisation, not personal accounts. More than one admin (bus factor).

## Needs-evidence (owner)
- Last restore test + measured RTO (platform lead)
- DR plan document + last exercise date (platform lead)
- Who holds production access and when it was last reviewed (system owner)

## Severity hints
Public DB, long-lived prod keys in CI, no backups in production → Critical. No rollback, no IaC for prod, no budget alerts → High.
