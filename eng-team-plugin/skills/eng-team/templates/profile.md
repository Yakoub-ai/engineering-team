# Project profile (scope contract)

Copied to `.eng-team/profile.md` by `/eng-init`. Each field is marked `# required` or `# optional`. After the value, note its provenance as a trailing comment: `# inferred: <file>` or `# stated`. Required fields must be non-empty before the init gate passes.

```yaml
name:                          # required — project name
summary:                       # required — one sentence: what it does, for whom
owner:                         # required — accountable person (name/role)
stage: prototype               # required — prototype | pilot | production | scale
criticality: low               # required — low | important | critical (DORA: supports a critical/important function?)
type:                          # required — internal-tool | data-pipeline | client-website | b2c-app | b2b-saas | api-platform | ml-system | other:<text>
users:                         # required — internal | external-business | consumers | public-anonymous
tenancy: single                # optional — single | multi-tenant
data_classes: [personal]       # required — none, personal, special-category, financial, credentials, children, health
jurisdictions: [eu]            # required — eu plus country codes (se, de, …) or others (uk, us, …)
sector:                        # optional — free text, e.g. insurance, public-sector, payments
frameworks: []                 # optional — pci-dss, hipaa, soc2, iso27001, …
regulated:
  financial_entity: no         # required — yes | no → DORA
  nis2_entity: unknown         # required — yes | no | unknown
  ai_act_role: none            # required — none | provider | deployer
  ai_high_risk_use: no         # optional — yes | no
residency: eu-only             # required — eu-only | eea | global | contract-specific
payments: none                 # optional — none | via-psp | stores-card-data
ai_usage: none                 # optional — none | llm-api | self-hosted-model | ml-predictions
stacks: []                     # required — azure, gcp, databricks, wordpress, web, or any free text (aws, sap-btp, k8s, …)
deploy_target:                 # optional — where it runs
has_ui: no                     # optional — yes | no
security_testing:
  dast_target: auto            # optional — auto | local | <non-production URL> | none (static only)
  cadence: auto                # optional — auto (from stage, see shared/orchestration.md) | per-release | monthly | quarterly
autonomy: gated                # required — gated | autonomous
coaching: on                   # optional — on | brief
audiences: [engineers]         # optional — engineers, business, ops, compliance, executives
standards:                     # optional — git URL or local path of federation standards repo; empty = none
priorities_override:           # optional — default: security > compliance > data > reliability > ux > cost
out_of_scope:                  # optional — free text
```
