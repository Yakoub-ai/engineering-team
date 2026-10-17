# Product discovery protocol

## Purpose

Understand what the product is for, who uses it, how, and how much, before any requirements interview or design. The result is `docs/engineering/product/product.md`, which the brief and later phases build on. It captures the product, not the technology.

## Protocol

1. **Skip what is known.** Do not ask what the context engine (`shared/context.md`), the profile, the README or existing docs already answer. Say what you inferred and from which file, for example: "Inferred persona 'support agent' from `docs/README.md`. Say so if that is wrong."
2. **One question per message**, in the layout from `challenger/interview.md`: the question, 2 to 4 options with the literal `(Recommended)` label on one, and `Why it matters:`. Accept "don't know" and record it as an open question.
3. **Work through the areas below in order.** Each names the `templates/product.md` section it fills. Ask 1 to 3 questions per area; stop an area early when it is covered.
4. **Push back** with the triggers in `challenger/interview.md`, plus these. "Users" or "everyone" → "Name the first three real people or roles." A use case without a trigger → "What happens right before they start?" A success metric without a number → "What number, by what date?"
5. **Stop** when the document has at least 3 use cases, 1 persona, 1 numeric success metric and non-goals, or the human has said they do not know and the gap is recorded. Whatever stays unknown goes to state.md Open questions.

### Areas

- **Purpose.** What is this for, and what happens if it does not exist? Fills: `Purpose`.
- **Users and personas.** Who uses it; for each, context, goal and how often. Fills: `Users and personas`; `profile.users`.
- **Stakeholders.** Who pays, approves, operates or is affected without using it? Fills: `Stakeholders`.
- **Use cases.** The top 3 to 7. For each: actor, trigger, outcome, priority. Number them UC-1, UC-2 and so on; later phases cite these IDs. Fills: `Use cases`.
- **Usage profile.** How many users or requests, how often, when the peaks are, on which devices, from which places. Offer ranges. Fills: `Usage profile`.
- **Jobs to be done.** "When <situation>, I want to <motivation>, so I can <outcome>." Fills: `Jobs to be done`.
- **Non-goals.** What is explicitly not included now. Fills: `Non-goals`; `profile.out_of_scope`.
- **Success metrics.** Numbers with a baseline and a date. Fills: `Success metrics`.
- **Constraints.** Budget, deadline, regulation, required tech. Fills: `Constraints`. Details the interview covers later (data classes, residency, SLAs) can wait for `challenger/interview.md`.
- **Fears.** What worries the human most about this product? Fills: `Fears and known risks`.

## Output

Write `docs/engineering/product/product.md` from `templates/product.md`: `Audience:` and `Last verified against:` header lines, every section filled or marked "not known, see questions", within 90 lines. If `challenger/brainstorm.md` ran, fill `Directions considered` from it. Add rows to state.md `## Open questions` and `## Assumptions` for gaps. Fill profile fields learned and mark them `# stated` or `# inferred: <file>`.

In autonomous mode, do not ask. Derive what you can from the request and the repository, give each guess an Assumptions row with `Source: agent`, and keep use cases and metrics conservative and clearly marked as assumed.
