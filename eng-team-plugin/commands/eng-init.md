---
description: "eng-team: set up this project (creates .eng-team/profile.md and state.md); --tour gives a skippable first-run tour and environment check"
argument-hint: "[--tour] [--autonomous|--auto] [project notes]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory, where `phases/`, `shared/` and `roles/` live. Then use it.

Before init, run `sh ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.sh`. It is read-only. Show only its `FAIL` and `warn` lines (none: say nothing). For a `FAIL`, give the fix it prints and do not install anything yourself (Environment and tooling in `shared/orchestration.md`: show the exact command, ask once).

**Tour.** With `--tour`, read `shared/tour.md` from the skill base directory, follow it and stop: it writes nothing and changes no gate, policy or autonomy, whether or not the project is initialised. Without `--tour`, when `.eng-team/state.md` does not exist and the run is gated, ask once: "New to eng-team? I can give a 5-minute tour first, or skip it." Run the tour on yes (then continue with init), skip it on no or silence. Never offer it in an autonomous run.

Run only the **init** phase as defined in `phases/init.md`, following the skill's Preconditions, State integrity (`shared/orchestration.md`) and Autonomy rules.

Arguments: $ARGUMENTS
- `--tour`: tour and environment check only; no files are written.
- `--autonomous` / `--auto`: offer autonomous mode instead of asking for the autonomy field; it starts only after you confirm and only if the policy written in this run allows it (`shared/policy.md`).
- Any other text: extra context about the project, used to fill the profile.
