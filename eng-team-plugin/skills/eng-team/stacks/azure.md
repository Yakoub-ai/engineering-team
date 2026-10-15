---
id: azure
kind: stack
status: reviewed
tier: plugin
sources:
  - title: Azure Well-Architected Framework
    url: https://learn.microsoft.com/azure/well-architected/
    accessed: 2026-10-15
  - title: Azure security benchmark
    url: https://learn.microsoft.com/security/benchmark/azure/
    accessed: 2026-10-15
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.stacks contains "azure"
---
# Stack pack: Azure

Applies to every role. Look in Bicep/ARM/Terraform, Azure DevOps YAML, app settings, `local.settings.json`, `appsettings*.json`.

**Identity & secrets (SEC/PLT)**
- Managed identities / workload identity federation for apps and pipelines; no client secrets or storage account keys in config. Service connections in Azure DevOps use workload identity federation, not secrets.
- Key Vault with RBAC (not access policies), soft delete + purge protection, private endpoint, references via `@Microsoft.KeyVault(...)` app settings.
- Storage: `allowSharedKeyAccess: false` where possible, no SAS tokens with long expiry in code, `allowBlobPublicAccess: false`, min TLS 1.2.
- Entra ID: app registrations with least-privilege API permissions; no `*.ReadWrite.All` without justification; Conditional Access/MFA for admins (needs-evidence).
- RBAC assignments scoped to resource/resource group, not subscription Owner/Contributor for apps or pipelines; PIM for humans (needs-evidence).

**Network (PLT)**
- Private endpoints for SQL, Storage, Key Vault, Cosmos, Service Bus; `publicNetworkAccess: Disabled` where feasible.
- NSGs without `Any`/`Internet` inbound on management ports; Front Door/App Gateway WAF for public apps.

**Data & residency (CMP/DAT)**
- Regions pinned (e.g. `swedencentral`, `westeurope`, `northeurope`); check every resource incl. Log Analytics, App Insights, backups (geo-redundant pairs stay in-region pairs — verify pair is acceptable), Azure OpenAI deployment type (avoid Global deployments when data must stay in the EU; use Data Zone EU or regional).
- Azure Policy: allowed locations, deny public network access, require tags, Defender for Cloud enabled.
- SQL: TDE, Entra-only auth, auditing to Log Analytics, PITR + LTR retention aligned with policy.

**Ops (SRE/PLT)**
- Diagnostic settings sending logs to Log Analytics on all resources; App Insights with sampling + PII considerations; Activity log alerts for role assignments and policy changes.
- Budgets + action groups per subscription/RG; cost anomaly alerts.
- Resource locks on production data stores.
