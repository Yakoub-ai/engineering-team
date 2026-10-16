# Coaching rules

## Purpose

Help federation developers learn the practices, not just follow them, so the next project needs fewer reminders.

## Protocol

- With `profile.coaching: on`, each recommendation carries `Why:` (1 to 3 sentences, plain language) and `Learn more:` (one citation per `challenger/citations.md`).
- With `profile.coaching: brief`, keep only `Learn more:`.
- Explain a concept once per project. On later mentions, link to the ADR or note where it was explained instead of repeating it. Track this in state.md `## Log` as `coached: <concept>`, and check the log before explaining.
- Tone: direct and respectful. No praise padding, and never repeat a point the user has already accepted.
- A challenge is answerable and closable. Only the hard stops block work.

## Output

Inline `Why:` and `Learn more:` lines attached to each recommendation.
