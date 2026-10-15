# Project profile (scope contract)

Fill this before dispatching roles. Mark each field `inferred` (with source file) or `stated` (by user). Unknown fields that change role activation must be asked.

```yaml
name:
mode: plan | review | gate
stage: prototype | pilot | production | scale
criticality: low | important | critical      # DORA: supports a critical or important function?
type: internal-tool | data-pipeline | client-website | b2c-app | b2b-saas | api-platform | ml-system
users: internal | external-business | consumers | public-anonymous
tenancy: single | multi-tenant
data_classes: [none, personal, special-category, financial, credentials, children, health]
regulated:
  financial_entity: yes | no                 # bank/insurer/investment etc. → DORA applies
  nis2_entity: yes | no | unknown            # essential/important entity
  ai_act_role: none | provider | deployer
  ai_high_risk_use: yes | no                 # e.g. life/health insurance pricing, credit scoring, HR
residency: eu-only | eea | global | contract-specific
payments: none | via-psp | stores-card-data
ai_usage: none | llm-api | self-hosted-model | ml-predictions
stacks: [azure, gcp, databricks, wordpress, web]   # add others as free text
deploy_target:
priorities_override:                         # default: security > compliance > data > reliability > ux > cost
out_of_scope:
```

## Role activation matrix

| Role | Activate when |
|---|---|
| security-engineer | Always |
| compliance-officer | Always (EU baseline). Deep mode if `data_classes` ≠ none, `financial_entity`, `nis2_entity`, or `ai_act_role` ≠ none |
| qa-engineer | Always |
| data-engineer | Any persistent store, data pipeline, or `payments` ≠ none |
| platform-engineer | Anything deployed beyond a local machine |
| sre | `stage` ≥ pilot, or `criticality` ≥ important |
| integration-engineer | Exposes or consumes APIs/webhooks, OAuth, or `payments` ≠ none, or type = b2b-saas/api-platform |
| ai-engineer | `ai_usage` ≠ none |
| product-engineer | Has a user interface or sends user-facing email/notifications |

## Compliance profile selection

| File | Load when |
|---|---|
| `compliance/eu-gdpr.md` | `data_classes` contains anything personal (default for almost everything) |
| `compliance/eu-dora.md` | `financial_entity: yes` |
| `compliance/eu-nis2.md` | `nis2_entity: yes/unknown` and not covered by DORA (DORA is lex specialis for financial entities) |
| `compliance/eu-ai-act.md` | `ai_act_role` ≠ none |
| `compliance/eu-accessibility.md` | consumer-facing UI or public-sector customer |
| `compliance/us-optional.md` | only if user states US customers, HIPAA, PCI or SOC 2 |

## Stage gates (what "required" means)

- **prototype**: no real personal data, no secrets in repo, no public exposure without auth. Everything else → recommendations.
- **pilot**: real users or data → authZ, logging, backups, GDPR basics, secrets management required.
- **production**: full role checklists apply; needs-evidence items must have owners.
- **scale**: add performance, multi-region/DR targets, cost controls, on-call maturity.
