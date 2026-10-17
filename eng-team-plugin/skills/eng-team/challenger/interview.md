# Interview protocol

## Purpose

Get to a discovery brief that separates confirmed facts, assumptions and open questions. The interview fills the required fields of `.eng-team/profile.md` and every section of `templates/brief.md`, and it does so with as few questions as possible.

## Protocol

1. **Skip what is already known.** Do not ask anything that `.eng-team/profile.md` already answers or that the repo shows (manifests, CI files, infra code, README, existing docs). Say what you inferred and from which file, for example: "Inferred `stacks: [azure]` from `infra/main.bicep`. Say so if that is wrong."
2. **One question per message.** Use multiple choice where possible. Every question has a one-line `Why it matters:` and a recommended default marked `(Recommended)`. Accept "don't know" and record it as an open question.
   Use exactly this layout, with the literal labels `Why it matters:` and `(Recommended)`, and no second question or extra topic in the same message:

   ```
   Question N: <the question>
   a) <option> (Recommended)
   b) <option>
   c) <option>
   Why it matters: <one line>
   ```
   If the request itself uses untestable words ("fast", "secure", "scalable", "simple"), make the first question ask for measurable targets for them, before any other question.
3. **Question bank.** Work through the areas below in order, skipping per step 1. Each question names what it fills (`profile.<field>` or a brief section). Ask 3 to 5 per area at most; stop an area early when it is covered.
4. **Push back** using the triggers table when an answer is vague, contradictory or unowned.
5. **Stop** when every required profile field is filled and each brief section has content or a recorded open question. Do not keep asking for completeness' sake.

For federations of in-house developer groups, also ask who the other groups are that depend on or are depended on by this project. Shared platforms, shared identity and shared data stores are where hidden requirements live.

### Problem and value

- What problem are we solving, and what happens if we do nothing for six months? Fills: brief `Problem`; `profile.summary`.
- Who feels the problem today, and how do they work around it? (Recommended: name a team or role, not "users".) Fills: brief `Problem`.
- Is this replacing something existing? (a) nothing, new; (b) a spreadsheet or manual process; (c) another system we will retire; (d) an external product. Fills: brief `Proposed solution`; `profile.type`.
- Why now: is there a deadline, a contract, an audit or an incident behind it? Fills: brief `Problem`, `Status`.

### Users and stakeholders

- Who uses it: (a) our own staff; (b) business customers; (c) consumers; (d) anonymous public? Fills: `profile.users`.
- Does one deployment serve one organisation or several (tenancy)? Fills: `profile.tenancy`.
- Who sponsors this and who signs off scope changes? Fills: brief `Decisions needed`.
- Which other groups or systems must we integrate with, and who owns them? (Federation: name the owning group and a contact.) Fills: brief `Cost and risk`; `profile.deploy_target`.
- Who reads the docs: engineers only, or also business, ops, compliance or executives? Fills: `profile.audiences`.

### Scope and non-goals

- What is the smallest version that is useful to the first real user? (Recommended: one user, one workflow.) Fills: brief `Proposed solution`.
- What is explicitly not included in this phase? Fills: `profile.out_of_scope`.
- Is there a user interface? (a) yes; (b) API only; (c) batch or pipeline only. Fills: `profile.has_ui`; `profile.type`.
- What is the stage: (a) prototype to throw away; (b) pilot with real users; (c) production; (d) scaling an existing service? Fills: `profile.stage`.

### Data (classes, volumes, residency)

- What data will it hold or touch: none, personal, special-category, financial, credentials, children, health? Name the actual fields (emails, names, IPs, free text). Fills: `profile.data_classes`.
- Roughly how many records or users now and in 12 months, and how fast do they grow? Fills: brief `Cost and risk`.
- Where must the data live: (a) EU only (Recommended); (b) EEA; (c) anywhere; (d) fixed by a contract? Fills: `profile.residency`; `profile.jurisdictions`.
- How long must data be kept, and who can ask for deletion or export? Fills: brief `Cost and risk`.
- Does it use AI: (a) no; (b) hosted LLM API; (c) self-hosted model; (d) ML predictions? Does any of it affect decisions about people? Fills: `profile.ai_usage`; `profile.regulated.ai_act_role`; `profile.regulated.ai_high_risk_use`.

### Constraints (budget, timeline, skills, existing systems)

- What is the budget, one-off and recurring per month? (A range is fine.) Fills: brief `Cost and risk`.
- What is the hard date, if any, and what is the cost of missing it? Fills: brief `Status`, `Decisions needed`.
- What does the team know well? Offer the stacks seen in the repo. (Recommended: pick what the team already runs in production.) Fills: `profile.stacks`.
- Which existing platforms, clouds, identity providers or approved vendor lists must we use? Fills: `profile.deploy_target`; `profile.standards`.
- Is there a federation standards repo or architecture board whose rules apply? Fills: `profile.standards`.

### Regulation and risk

- Does this support a critical or important function of a financial entity (DORA)? Fills: `profile.regulated.financial_entity`; `profile.criticality`.
- Is the organisation an essential or important entity under NIS2? (a) yes; (b) no; (c) unknown, check with legal. Fills: `profile.regulated.nis2_entity`.
- Does it take payments: (a) no; (b) through a payment provider; (c) stores card data? Fills: `profile.payments`; `profile.frameworks`.
- Which sector rules or certifications apply (insurance, public sector, ISO 27001, SOC 2)? Fills: `profile.sector`; `profile.frameworks`.
- What is the worst realistic failure: data leak, wrong decision, outage, money lost? Fills: brief `Cost and risk`; `profile.criticality`.

### Operations (owner, SLAs)

- Who is accountable when it breaks at 03:00, by name or rota? Fills: `profile.owner`.
- What availability and recovery do users need? Ask for hours of tolerable downtime per month and tolerable data loss. Fills: brief `Cost and risk`; `profile.criticality`.
- Who deploys, monitors and patches it after launch? (a) this team; (b) a platform group; (c) a vendor. Fills: brief `Proposed solution`; `profile.deploy_target`.
- How much autonomy should the team have: stop at each gate for approval (Recommended) or run autonomously within the hard stops? Fills: `profile.autonomy`; `profile.coaching`.

### Success metrics

- How will we know in 90 days that it worked? Ask for one number and a date. Fills: brief `Problem`, `Status`.
- What is the baseline today? (If unknown, record an open question.) Fills: brief `Problem`.
- What would make us stop or change course? Fills: brief `Decisions needed`.

### Pushback triggers

| Trigger | Follow-up |
|---|---|
| Vague quality word: fast, secure, scalable, simple, real-time | "What number or acceptance criterion would tell us it is met? For example p95 under 300 ms, or 500 concurrent users." |
| Solution stated as the problem: "we need Kafka", "microservices", "an AI" | "What outcome does that serve, and what happens if we don't build it?" |
| No owner named | "Who is accountable when it breaks at 03:00?" |
| Contradiction with the repo or an earlier answer | Quote both statements and ask which is true. Do not pick one silently. |
| "No personal data" while the design stores emails, names or IPs | Name the field and cite GDPR Art. 4(1): any information relating to an identifiable person is personal data. Ask whether to correct `data_classes`. |
| "Everyone" as the user group | "Name the first three real users or roles." |
| "As soon as possible" as a deadline | "Is there a date where missing it has a cost? What is the cost?" |

Pushback is one follow-up per trigger. If the user holds their position after one challenge, record their answer, mark it `stated`, and move on.

## Autonomy

In `autonomous` mode, do not ask. Answer each question with the most conservative reasonable default (smallest scope, EU-only residency, higher criticality when unsure, regulated when unknown) and record it in `state.md` under Assumptions with `Source: agent` and a confidence level (high, med, low). Questions that cannot be defaulted safely, such as the accountable owner, go to Open questions instead.

## Output

Write `docs/engineering/product/brief.md` from `templates/brief.md`, within its length limit. Facts the user confirmed are stated plainly; assumptions are marked as such; unresolved items appear under `Decisions needed`. Add rows to state.md `## Open questions` (ID, question, why it matters, phase) and `## Assumptions` (ID, assumption, confidence, what would change it, source). Fill the profile fields gathered along the way and mark each `# stated` or `# inferred: <file>`.
