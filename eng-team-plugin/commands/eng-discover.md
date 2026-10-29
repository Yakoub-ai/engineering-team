---
description: "eng-team: run the discover phase (see skills/eng-team/phases/discover.md)"
argument-hint: "[--force \"<reason>\"] [--skip \"<reason>\"] [--autonomous|--auto|--gated] [notes]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory, where `phases/`, `shared/` and `roles/` live. Then use it. Run only the **discover** phase as defined in `phases/discover.md`, following the skill's Preconditions, State integrity (`shared/orchestration.md`) and Autonomy rules.

Arguments: $ARGUMENTS
- `--force "<reason>"`: run anyway even if an earlier gate is open; the reason is the quoted argument. Set each earlier gate that is not `passed|skipped` to `forced` and log `- YYYY-MM-DD forced discover: <reason>` in `.eng-team/state.md`.
- `--skip "<reason>"`: in gated mode, a human marks this phase `skipped` instead of running it; log the reason in `.eng-team/state.md`.
- `--autonomous` (or `--auto`) / `--gated`: run autonomously only after you confirm the risks and only if `.eng-team/policy.json` allows it (`shared/policy.md` → Activating autonomous mode); `--gated` forces gated.
- Any other text: extra context from the user for this phase.
