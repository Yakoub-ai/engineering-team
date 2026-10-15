---
id: databricks
kind: stack
status: reviewed
tier: plugin
sources:
  - title: Databricks lakehouse architecture
    url: https://docs.databricks.com/aws/en/lakehouse-architecture/
    accessed: 2026-10-15
  - title: Databricks security best practices
    url: https://docs.databricks.com/aws/en/security/
    accessed: 2026-10-15
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.stacks contains "databricks"
---
# Stack pack: Databricks

Look in `databricks.yml` (Asset Bundles), `resources/*.yml`, notebooks (`.py`, `.ipynb`, `.sql`), job/cluster JSON, Terraform `databricks_*` resources.

**Identity & secrets (SEC/PLT)**
- Production jobs run as **service principals** (`run_as`), not personal users. Bundle `targets.prod` sets `run_as` and `permissions`.
- CI authenticates with OAuth M2M / workload identity federation, not personal access tokens. Grep for `dapi` tokens in code, notebooks, `.databrickscfg`, CI vars.
- Secrets via secret scopes (Key Vault-backed on Azure) — never hardcoded in notebooks; no `print(dbutils.secrets.get(...))`.
- Notebook outputs committed to git can contain personal data or secrets → strip outputs (check `.ipynb` cells with outputs).

**Governance (CMP/DAT)**
- Unity Catalog enabled; data in UC tables not legacy Hive metastore/DBFS; grants at catalog/schema level to groups, not individuals.
- PII columns tagged; column masks / row filters for sensitive data; separate catalogs per environment (`dev`/`test`/`prod`) — prod data not readable from dev.
- **Erasure & retention**: Delta time travel keeps deleted rows — `DELETE` + `VACUUM` with retention ≤ policy (default 7 days `deletedFileRetentionDuration`; check overrides that extend it), and check change data feed / deep clones / shallow clones that still hold old data.
- Lineage and audit via system tables (`system.access.audit`) enabled and retained.

**Pipelines (DAT/QA)**
- Idempotent writes: `MERGE` or partition overwrite, not blind `append` on reruns; expectations (DLT/Lakeflow) or explicit data-quality checks on inputs.
- Unit tests for transformation logic outside notebooks (functions in modules + pytest); bundle validated in CI (`databricks bundle validate`), deployed per target.
- Schema evolution explicit (`mergeSchema` not left on blindly).

**Platform & cost (PLT)**
- Cluster policies enforcing autotermination, max workers, allowed node types, tags; job clusters/serverless over all-purpose clusters for jobs.
- Budgets/usage dashboards from `system.billing.usage`; alerts on spend.
- Workspace: IP access lists / private link, no public DBFS mounts with keys, serverless egress controls for sensitive data.

**ML (AI)**
- Models in UC model registry with versions/aliases; feature tables governed like any other personal data; serving endpoints authenticated, with rate limits and inference tables reviewed for PII.
