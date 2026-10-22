# Project profile (scope contract)

Field definitions live in `templates/profile.md`; the project's filled copy is `.eng-team/profile.md`.

## Role activation matrix

| Role | Activate when |
|---|---|
| security-engineer | Always |
| compliance-officer | Always (EU baseline). Deep mode if `data_classes` ≠ none, `financial_entity`, `nis2_entity`, `ai_act_role` ≠ none, or `cra_role` is a named role (not none or unknown) |
| qa-engineer | Always |
| data-engineer | Any persistent store, data pipeline, or `payments` ≠ none |
| platform-engineer | Anything deployed beyond a local machine |
| sre | `stage` ≥ pilot, or `criticality` ≥ important |
| integration-engineer | Exposes or consumes APIs/webhooks, OAuth, or `payments` ≠ none, or type = b2b-saas/api-platform |
| ai-engineer | `ai_usage` ≠ none |
| product-engineer | `has_ui: yes`, sends user-facing email/notifications, or exposes a CLI, API or agent interface (experience review only) |
| researcher | Any phase needs a pack with no tier match, or the research phase runs |
| architect | Discover and architect phases |
| builder | Build phase |
| tester | Test phase |
| tech-writer | Document phase |

## Compliance profile selection

Selection is by each pack's `applies_when` frontmatter (see `templates/pack.md`); the table below documents the intent.

| File | Load when |
|---|---|
| `compliance/eu-gdpr.md` | `data_classes` contains anything personal (default for almost everything) |
| `compliance/eu-dora.md` | `financial_entity: yes` |
| `compliance/eu-nis2.md` | `nis2_entity: yes/unknown` and not covered by DORA (DORA is lex specialis for financial entities) |
| `compliance/eu-ai-act.md` | `ai_act_role` ≠ none |
| `compliance/eu-cra.md` | `cra_role` ≠ none (`unknown` loads it until classified) |
| `compliance/eu-accessibility.md` | consumer-facing UI or public-sector customer |
| `compliance/us-optional.md` | only if user states US customers, HIPAA, PCI or SOC 2 |

## Pack resolution

1. For each need, look in `.eng-team/packs/` (tier project), then the federation standards repo `packs/` (tier federation), then the plugin `stacks/ compliance/ practices/` (tier plugin). The first pack whose `applies_when` evaluates true wins per `id`.
2. If a profile `stacks` / `jurisdictions` / `frameworks` value matches no pack, the researcher builds a project pack.
3. Record every pack used in `state.md` → "Packs in use".

### Evaluating `applies_when`

`always` is true; `NOT` applies to the single comparison that follows it, or to a parenthesised group (`NOT ( … )` is allowed); `AND` binds tighter than `OR`; parentheses group; `contains` tests list membership, or substring for a string field; an unknown or empty field is false for `==` and `contains` and true for `!=`.

## Stage gates (what "required" means)

- **prototype**: no real personal data, no secrets in repo, no public exposure without auth. Everything else → recommendations.
- **pilot**: real users or data → authZ, logging, backups, GDPR basics, secrets management required.
- **production**: full role checklists apply; needs-evidence items must have owners.
- **scale**: add performance, multi-region/DR targets, cost controls, on-call maturity.
