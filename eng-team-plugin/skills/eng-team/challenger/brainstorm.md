# Brainstorming protocol

## Purpose

Turn an idea into one chosen direction before product discovery starts. Use it when the request is an idea, not a defined product. The result is a short list of directions, one choice made with the human, and the rejected ones recorded.

Trigger it when any of these holds:

- the request names no users, or no use case;
- the request reads like "I want to build something that…";
- the human asks to brainstorm.

Skip it when the request already states users, a use case and a goal. Say that you skipped it and why.

## Protocol

1. **Restate.** Say the idea back in two or three sentences, in plain words. Ask the human to correct it. Do not add features.
2. **Diverge.** Offer 3 to 5 materially different directions. Different means a different approach, not a different tool for the same approach. Always include "don't build: buy or configure an existing product". For each direction give one line on what it is, one on who it suits and one on its main cost or risk. Use the context engine's output (`shared/context.md`) to rule out directions the repo already contradicts, and say which file told you.
3. **Converge.** Ask the human to choose one, using the interview layout from `challenger/interview.md`: one question, `Why it matters:`, 2 to 4 options, the literal `(Recommended)` label on one. Base the recommendation on purpose, users and constraints, and state the reason in the option. If the human wants to combine directions, ask which one leads.
4. **Record.** Keep the chosen direction as the starting point for `challenger/product-discovery.md`. Keep every rejected direction with its reason for `## Directions considered` in `docs/engineering/product/product.md`.
5. **Continue.** Go straight to product discovery. Do not start the requirements interview here.

One question per message. Accept "none of these" and ask what is missing from the options, once.

## Output

- A chosen direction (one or two sentences), carried into product discovery.
- Rejected directions, each with a one-line reason, written to `## Directions considered` in `docs/engineering/product/product.md` (`templates/product.md`).
- In autonomous mode: pick the direction with the smallest scope that meets the stated idea, record it in state.md Assumptions with `Source: agent`, and list the other directions as rejected with the reason "smaller scope preferred; confirm later".
