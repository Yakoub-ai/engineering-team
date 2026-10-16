# Project profile (scope contract)

Copied to `.eng-team/profile.md` by `/eng-init`. Each field is marked `# required` or `# optional`. After the value, note its provenance as a trailing comment: `# inferred: <file>` or `# stated`. Required fields must be non-empty before the init gate passes.

```yaml
name: planted-api              # required — project name # stated
summary: Invoice API for small businesses  # required — one sentence: what it does, for whom # stated
owner: Test Owner              # required — accountable person (name/role) # stated
stage: production              # required — prototype | pilot | production | scale # stated
criticality: important         # required — low | important | critical (DORA: supports a critical/important function?) # stated
type: api-platform             # required — internal-tool | data-pipeline | client-website | b2c-app | b2b-saas | api-platform | ml-system | other:<text> # stated
users: external-business       # required — internal | external-business | consumers | public-anonymous # stated
tenancy: multi-tenant          # optional — single | multi-tenant # stated
data_classes: [personal, financial]  # required — none, personal, special-category, financial, credentials, children, health # stated
jurisdictions: [eu, se]        # required — eu plus country codes (se, de, …) or others (uk, us, …) # stated
sector:                        # optional — free text, e.g. insurance, public-sector, payments
frameworks: []                 # optional — pci-dss, hipaa, soc2, iso27001, …
regulated:
  financial_entity: no         # required — yes | no → DORA # stated
  nis2_entity: unknown         # required — yes | no | unknown # stated
  ai_act_role: none            # required — none | provider | deployer # stated
  ai_high_risk_use: no         # optional — yes | no
residency: eu-only             # required — eu-only | eea | global | contract-specific # stated
payments: via-psp              # optional — none | via-psp | stores-card-data # stated
ai_usage: none                 # optional — none | llm-api | self-hosted-model | ml-predictions
stacks: [web]                  # required — azure, gcp, databricks, wordpress, web, or any free text (aws, sap-btp, k8s, …) # stated
deploy_target:                 # optional — where it runs
has_ui: no                     # optional — yes | no
autonomy: gated                # required — gated | autonomous # stated
coaching: on                   # optional — on | brief
audiences: [engineers]         # optional — engineers, business, ops, compliance, executives
standards:                     # optional — git URL or local path of federation standards repo; empty = none
priorities_override:           # optional — default: security > compliance > data > reliability > ux > cost
out_of_scope:                  # optional — free text
```
