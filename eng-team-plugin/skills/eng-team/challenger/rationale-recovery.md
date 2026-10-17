# Rationale recovery protocol

## Purpose

Existing code carries decisions whose reasons were never written down. Recover the significant ones with the human, so reviewers and later phases treat them as context and do not silently override them or guess at intent. The result is one **recovered ADR** per decision in `docs/engineering/decisions/`.

## Protocol

1. **Find the decisions.** From the code, config and context snapshot (`.eng-team/context.md`), list decisions in these categories: language and framework, data store, auth model, hosting and deploy, architecture style, tenancy, data residency, major third-party services, and anything unusual or apparently risky (for example no auth on an endpoint, or data in an unexpected region). Cite `path:line` for what shows each decision. Skip any decision an existing ADR already records.
2. **Cap and order.** Keep at most 8. Order by risk: security boundaries, data residency and data stores first; stack and style choices last. Say which candidates were dropped.
3. **One question per message** per decision, in the layout from `challenger/interview.md`: the question, 2 to 4 options with the literal `(Recommended)` label on one, and `Why it matters:`. Name the decision and the evidence, then ask what was decided, why, which alternatives were considered, and whether it still holds. Options are the likely reasons you can infer from the code (for example "cost", "team skill", "customer requirement") plus "I don't know the reason". Never present an inferred reason as fact.
4. **Record exactly what the human says.** Put the reason in the ADR verbatim. If the human does not know, write `reason not recorded` and add an item to `docs/engineering/questions.md` naming the decision, the ADR and who might know. Do not assume intent.
5. **Ask whether it still holds.** If the human says it no longer holds, set the ADR status to `accepted (recovered)` anyway, note the doubt in Consequences, and add a questions item to revisit it. Do not change the decision here.
6. **Stop** after the capped list is covered or the human says to stop. Remaining candidates go to `docs/engineering/questions.md`.

## Output

For each decision, write `docs/engineering/decisions/NNNN-<slug>.md` (next free 4-digit number) from `templates/adr.md`:

- `Status: accepted (recovered)`, `Recovered: yes`, `Recovered with: <human name>`.
- `Decided by: <original owner>` if known, else `unknown`.
- `Date:` today. In Context, say what the code shows, with `path:line`.
- Options considered: the alternatives the human named, or `not recorded`.
- Decision and rationale: the human's words, or `reason not recorded`.
- Challenges raised: leave the table with no rows; this is a record, not a design round.

Add a row per ADR to state.md `## Decisions` with `Decided by` as in the ADR. Reviewers treat the stated trade-off as context (`shared/findings.md` → Recovered decisions).

In autonomous mode, do not ask. Write each ADR with `Recovered with: none (autonomous)`, `Decided by: unknown`, the rationale `reason not recorded`, and a `docs/engineering/questions.md` item for each, so a human can answer later.
