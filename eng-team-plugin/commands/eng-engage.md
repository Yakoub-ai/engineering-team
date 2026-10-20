---
description: "eng-team: run a client engagement (agent-formulated stakeholder questionnaires, meeting guide, workflow mapping, build-or-buy recommendation, any domain; see skills/eng-team/phases/engage.md)"
argument-hint: "[--lang sv|en|sv,en] [--domain <name>] [--client-type <type>] [--area <id>] [--stage scoping|pre-meeting|meeting|mapping|recommendation] [notes]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory, where `phases/`, `challenger/`, `questionnaires/` and `templates/` live. Then use it. Run the **engagement** flow as defined in `phases/engage.md`. It is standalone: it does not need `.eng-team/state.md`, does not touch gates, and writes only under `docs/engineering/engagement/`, `.eng-team/questionnaires/` and `.eng-team/research/`.

Arguments: $ARGUMENTS
- `--lang`: pack and report languages. Default `sv`.
- `--domain`, `--client-type`, `--area`: skip the matching scope question; `--area` may repeat. Any domain works: shipped modules exist for legal teams only, and agents formulate the questionnaire for other domains (saved to `.eng-team/questionnaires/`, always `unreviewed`).
- `--stage`: run that stage only, if `ENGAGEMENT.md` allows it; otherwise resume from the recorded stage.
- Any other text: extra context (who the client is, which team, what was said) for the current stage.
