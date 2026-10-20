# Workflow mapping protocol

## Purpose

Describe how a team actually works today, from evidence rather than from the official process, and agree a target flow with them. Produce a step-by-step as-is map with pain points, then a to-be sketch. The map is the input to `challenger/solution-fit.md`.

## Protocol

1. **Start from a real case.** Use the walkthrough question (`Q-CORE-11`) or a shadowing session (`templates/day-in-life.md`). Map one recent, ordinary case first, then one difficult one. Do not map "the process" from a description.
2. **Record each step** in `templates/workflow-map.md`: step, actor (role, not name), system or tool, input, output, handoff to whom, elapsed time and touch time, frequency, and the rule that drives it ("always", "judgement", "depends on client"). Mark every figure `stated`, `observed` or `estimated`.
3. **Mark pain.** For each step note the pain, who feels it, the workaround, and an error or rework example. Quote the stakeholder briefly; keep names out.
4. **Mark rule clarity.** Rate each step: R1 fully rule-based, R2 rules with exceptions, R3 judgement with a checklist, R4 pure legal judgement. This rating, not enthusiasm, decides what can be supported.
5. **Mark data.** For each step list the data it touches and its class (public, internal, personal, special-category, criminal-offence, privileged, state-secret or classified). Anything above internal feeds the guardrails check in `challenger/solution-fit.md`.
6. **Check back.** Show the as-is map to the team and correct it. A map nobody on the team recognises is not finished.
7. **Sketch the to-be** only for steps with an opportunity: what changes, what stays human, what the new handoff is. Do not name products here.

## Output

- `docs/engineering/engagement/workflow-<team>-<name>.md` from `templates/workflow-map.md`, with as-is, pain points, rule clarity, data classes and a to-be sketch.
- Candidate opportunities to be scored per `challenger/solution-fit.md`.
