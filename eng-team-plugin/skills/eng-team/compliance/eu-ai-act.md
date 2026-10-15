---
id: eu-ai-act
kind: compliance
status: reviewed
tier: plugin
sources:
  - title: Regulation (EU) 2024/1689 (AI Act)
    url: https://eur-lex.europa.eu/eli/reg/2024/1689/oj
    accessed: 2026-10-15
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.regulated.ai_act_role != "none"
---
# Compliance profile: EU AI Act (Regulation (EU) 2024/1689, as amended by the 2026 AI Omnibus)

Timeline (verify before relying on it — dates have moved before):
- Prohibited practices (Art. 5) + AI literacy (Art. 4): from 2 Feb 2025
- General-purpose AI model obligations: from 2 Aug 2025
- Stand-alone high-risk (Annex III): **2 Dec 2027** (deferred from Aug 2026 by the AI Omnibus)
- High-risk embedded in regulated products (Annex I): **2 Aug 2028**
- Transparency (Art. 50): check current application/grace dates

## Step 1 — classify (always do this; it's cheap)
- **Role**: provider (you build/put on market under your name) vs. deployer (you use it). Fine-tuning or substantially modifying can make a deployer a provider.
- **Prohibited?** Manipulation, social scoring, certain biometric uses, emotion recognition at work → stop and escalate.
- **High-risk (Annex III)?** Relevant examples: **risk assessment and pricing for life and health insurance**, creditworthiness, employment/HR decisions, access to essential services. If yes → full high-risk track.
- **Transparency only?** Chatbots, generated/manipulated content → disclosure duties.
- Otherwise: minimal risk — AI literacy + good practice.

## Step 2 — high-risk obligations (evidence in code where possible)
| Obligation | Code/config evidence |
|---|---|
| Risk management system (Art. 9) | — needs-evidence |
| Data governance, bias examination (Art. 10) | Training data lineage, bias tests in pipeline |
| Technical documentation (Art. 11) | Model card, architecture docs |
| Record-keeping / automatic logs (Art. 12) | Inference logging with inputs/outputs/version, retained |
| Transparency to deployers (Art. 13) | Instructions for use |
| Human oversight (Art. 14) | Override/review path in the product, not just policy |
| Accuracy, robustness, cybersecurity (Art. 15) | Evals, drift monitoring, adversarial tests (links to AI role) |
| Deployer duties (Art. 26) | Monitoring, log retention, informing affected persons |
| Fundamental rights impact assessment (Art. 27) | Required for certain deployers incl. insurance pricing use cases → needs-evidence |

## Step 3 — transparency (Art. 50)
- Users told they interact with an AI system (chatbots).
- AI-generated content marked as such where required.

Combine with GDPR Art. 22 and DPIA — the same use case often triggers both.
