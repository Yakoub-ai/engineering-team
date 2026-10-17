# Devil's-advocate round

## Purpose

Stress-test a significant decision before it is made, so the team chooses with the best alternative and the likely failures in view. The round argues against the leading option; it does not block the decision unless a hard stop applies.

### Significant-decision test

A decision is significant if it affects any of:

- cost: more than 10% of the budget, or any recurring spend
- data: storage, residency or classification
- a security boundary
- vendor lock-in
- or it is hard to reverse

Non-significant decisions get no round. Decide them, and move on.

## Protocol

1. **Steelman.** State the strongest honest case for the best rejected option, as its advocate would put it. No strawmen.
2. **Pre-mortem.** "It is <today + 12 months, absolute date> and this failed." List the top 3 failure modes, each with a likelihood (low, med, high) and an early warning sign.
3. **Assumption audit.** Fill this table for the assumptions the decision rests on:

   | Assumption | Confidence | Evidence that would change the decision |
   |---|---|---|

4. **Reversibility.** Classify the decision. One-way door: require explicit human approval, even in gated sub-steps, and slow down. Two-way door: decide fast and note the rollback in Consequences.

Rules:

- Every challenge cites a source per `challenger/citations.md` or is labelled `opinion:`.
- Ask the user to answer each challenge. A challenge is closed once it has a response; it does not need agreement.
- Record each challenge, the response and the source in the ADR's `## Challenges raised` table.

## Autonomy

In `autonomous` mode the agent writes the response to each challenge itself and sets `Decided by: agent`. It still stops for any one-way-door decision that touches data deletion, residency or security boundaries; these are hard stops.

## Output

An ADR draft in `templates/adr.md` format (Context, Options considered, Decision, Consequences, Challenges raised), within its one-page limit, returned to the orchestrator. The orchestrator saves it to `docs/engineering/decisions/NNNN-<slug>.md` and adds a row to state.md `## Decisions`. For ADR style, see `pack:adr-writing`. When saving each ADR, fill the `Decided by:` line with the approving human's name (gated) or `agent` (autonomous); never leave the template placeholder `<name> | agent`.
