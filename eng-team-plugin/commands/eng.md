---
description: "eng-team: run the full lifecycle from the current phase (discover → research → architect → build → test → document → review)"
argument-hint: "[--autonomous|--gated] [what you want to build or change]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory, where `phases/`, `shared/` and `roles/` live. Then use it. If `.eng-team/state.md` is missing, run init first: `phases/onboard.md` when the repo already has application code, otherwise `phases/init.md`. Then resume from `current_phase` and continue phase by phase, honouring each phase's exit criteria, the autonomy level, hard stops and loop limits.

Arguments: $ARGUMENTS
- `--tier S|M|L`: set `profile.track` (lean | standard | full) instead of auto.
- `--autonomous` / `--gated`: override `profile.autonomy` for this run.
- Any other text: the user's request; feed it to the discover phase.

Intake: if the request leaves the goal, users, data sensitivity or deploy target unclear, ask only those gaps (at most 5 questions, one per message, each with a recommended default). Then state the tier and reason in one line, give a short recommended approach, and challenge up to 3 assumptions in the request against best practice ("you said X; best practice is Y because Z; keep X?"). Autonomous mode asks nothing and records defaults as Assumptions.
