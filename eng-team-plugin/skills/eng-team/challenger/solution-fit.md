# Solution-fit protocol

## Purpose

Decide, per opportunity, whether to do nothing, fix the process, configure what the client already owns, buy, build or support a human decision, and show why. The recommendation is the main product of an engagement. The result feeds the existing lifecycle only when the answer is "build".

## Protocol

1. **List opportunities.** From the workflow maps and responses, one row per candidate in `templates/opportunities.md`: the step, the team, the pain, the volume and time per item, and the evidence for each figure (`stated`, `observed`, `estimated`).
2. **Score each opportunity** 1 to 5 on four dimensions, each with a one-line reason:
   - value: hours per month saved or risk removed, from volume × time × frequency;
   - clarity: the rule-clarity rating from `challenger/workflow-mapping.md` (R1 = 5, R2 = 4, R3 = 2, R4 = 1);
   - readiness: data available digitally, an owner, a stable process;
   - exposure: the opposite of safety, from data class and consequence of error (1 = low exposure, 5 = high).
   Rank by value × clarity × readiness, then show exposure beside it. Do not hide a high-value, high-exposure item; mark it for a guarded approach. Scores are the consultant's judgement and are labelled `opinion:` unless backed by a measurement.
3. **Apply the guardrails first.** Load the guardrails of the country and area modules in play (shipped under `questionnaires/` or formulated under `.eng-team/questionnaires/`), applying each only where its condition matches the team's data and decisions. A guardrail marked Stop removes the option it names for that opportunity until its condition is documented; record the removal and the condition in the recommendation. A guardrail marked Flag adds a check to the plan. Never recommend around a Stop.
4. **Choose the outcome** per opportunity with this order, and state which row applied:

   | Outcome | Choose when |
   |---|---|
   | Do not automate | Volume is low, the process is unstable or the pain is organisational; fix the process first |
   | Configure what is owned | A tool the client already pays for covers at least the core of the need |
   | Buy | A mature product covers the need, the data class and hosting rules allow it, and the work is not a differentiator |
   | Build | The work encodes the client's own know-how, no product fits the rules or data limits, or the work is glue between systems; and the client can maintain it (Q-CORE-10) or will pay for maintenance |
   | Assist only | Clarity is R3 or R4, or the output affects a person's rights; the tool drafts or searches, a named human decides and the suggestion and decision are both logged |

   These rows are the consultant's rule of thumb, labelled `opinion:`. Where two rows apply, take the one with lower exposure and say so.
5. **Name the people.** For every outcome, the owner at the client, the decision-maker and the first small step (a pilot with one team, a measurable target, a review date).
6. **Evaluate platforms** for each Buy and Configure outcome with `challenger/platform-evaluation.md`. For Build, dispatch `eng-architect` in read-only plan mode for a feasibility and effort range, and `eng-compliance-officer` for a review of the guardrails and the AI Act and GDPR position. Both returns follow the Hand-off contract in `shared/orchestration.md`.
7. **Write the recommendation** from `templates/recommendation.md`, then the client report from `templates/client-report.md`. For each Build item also write `docs/engineering/engagement/brief-seed-<opportunity>.md`, the starting point for `/eng-discover`.

## Output

- `docs/engineering/engagement/opportunities.md`.
- `docs/engineering/engagement/recommendation.md`, one section per opportunity, with outcome, rejected alternatives, guardrails applied, owner, first step and review date.
- `docs/engineering/engagement/client-report.md` in each requested language.
- A brief seed per Build item.
