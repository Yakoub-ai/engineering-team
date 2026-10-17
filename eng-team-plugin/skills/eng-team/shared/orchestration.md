# Orchestration mechanics

Loaded by `SKILL.md`. These are the orchestrator's own procedures for state, entry, loops and hard stops. Only the orchestrator writes `.eng-team/state.md` (including in the sequential fallback).

## State integrity

Runs on every start when `.eng-team/state.md` exists (skip it when there is no state). List every mismatch to the user, then repair (except in a standalone `/eng-review`: report mismatches only, never repair):
1. **Artifacts.** For each gate with status `passed`, check that its Evidence artifact exists. If it is missing, the repair is: set that gate to `open` and log `- YYYY-MM-DD state-repair: <phase> artifact missing`.
2. **Phase.** The expected phase is the first phase, in Phases-table order, whose gate is not `passed`, `skipped` or `forced` (if none, the project is complete and `current_phase` should be `review`). If `current_phase` differs, the repair is: set `current_phase` to the expected phase and log `- YYYY-MM-DD state-repair: current_phase <old> → <new>`.
3. **Layout.** If any old-layout path exists (`docs/brief.md`, `docs/adr/`, `.eng-team/plan.md`, `docs/onboarding-*.md`), list them and propose one `git mv` batch to the new paths (`docs/engineering/product/brief.md`, `docs/engineering/decisions/`, `docs/engineering/plans/plan.md`, `docs/engineering/onboarding-<date>.md`). In `gated`, apply it after approval; in `autonomous`, apply it directly; never in a standalone `/eng-review`. Then update Evidence paths in state.md and log `- YYYY-MM-DD state-repair: layout migrated to docs/engineering/`. Until migrated, readers accept both old and new paths.
- Standalone `/eng-review`: report mismatches only; do not modify state.md, apart from the `adhoc-review:` Log line.
- `gated`: ask the human before each repair and apply what they choose.
- `autonomous`: apply the repairs and log them.
Never delete rows from state.md; change statuses and append Log lines only.

After the integrity check, run the **due check** (report only, never a repair): if the last state.md Security audits row's `Next due` date has passed, if a lockfile or IaC file changed since that row's commit, or if `profile.stage` changed since then, tell the user "Security re-audit due: <reason>" and offer `/eng-security-audit`. Also list environment drift found by `phases/setup.md` → check (missing or outdated tools, setup that no longer works) and offer `/eng-setup update`.

## Entry

`/eng` resumes from `current_phase` and runs phases in order. `/eng-<phase>` and `/eng-promote` run only after the Preconditions in `SKILL.md` hold. `/eng-<phase>` runs one phase and refuses, naming the blocking gate, unless every earlier gate is `passed`, `skipped` or `forced`.
- `--force "<reason>"` runs the phase anyway: set each earlier gate that is not `passed|skipped` to `forced` and log `- YYYY-MM-DD forced <phase>: <reason>`. `--force` without a reason string is refused. It is logged in either autonomy mode.
- A gate becomes `skipped` only when a human runs a phase command with `--skip "<reason>"` in gated mode; log `- YYYY-MM-DD skipped <phase>: <reason>`. In autonomous mode `--skip` is refused.
- Exception: `/eng-review` invoked directly never refuses and never changes gates (see Preconditions in `SKILL.md`).

## Running a phase

Before starting, post a **Next up** note of at most 5 lines: the phase, the agents, what they will do, what you will be asked, and the outputs. Set its gate to `in-progress`, follow its file, then check every exit criterion yourself. Never trust an agent's "done". All pass → `passed` (with evidence, approver, date) and advance `current_phase`. Any fail → `failed`.

On `passed`, in this order:
1. Write `docs/engineering/handovers/NN-<phase>.md` from `templates/handover.md` (NN is the phase number, 2 digits: init 00 … review 07; onboarding writes 00).
2. Rewrite `docs/engineering/STATUS.md` from `templates/status.md` (rewrite, never append).
3. Update the phase statuses in `docs/engineering/team-plan.md`.
4. Refresh the context snapshot (`shared/context.md`).

Standalone commands (audit, setup, review) write a handover only when they change project direction.

## Gap review

At every gated approval, before asking for approval, walk the human through the new and still-open items in `docs/engineering/questions.md`. Each answer becomes a `# stated` profile field, an ADR, a plan task or an accepted risk, and the item moves to the Answered log. In `autonomous` mode, record each open item as an Assumptions row; it stays listed until a human confirms it. `docs/engineering/questions.md` mirrors state.md Open questions and Assumptions; state.md stays the machine source, so update both together.

## Continuous security testing

Security testing is part of the lifecycle and continues after it ends:
- **Planned** in architect (Security testing strategy, environment, security-tooling and DAST-readiness tasks).
- **Per task** in build (secret + SAST scan of the diff when scanners exist).
- **Per release** in test (full or static audit, `phases/test.md` step 4) and review (re-audit what changed).
- **After the lifecycle** by cadence and triggers, via the due check under State integrity.

Default cadence when `profile.security_testing.cadence` is `auto`: prototype → before each stage change; pilot → quarterly and before each release; production and scale → static on every pull request (CI), full audit before each release and at least monthly. Event triggers in every stage: dependency or lockfile change, new external endpoint or auth change, new data class, stage change, a disclosed vulnerability in a used dependency. Set `Next due` on every Security audits row from this.

Findings from an audit after the review gate passed reopen work via Loop-back with target build (Loop counter `audit→build`) only when the human approves (gated) or for High and lower (autonomous); a Critical always follows Critical findings below. Opinion: monthly static and pre-release full audits follow `practices/secure-sdlc.md`; the regulatory basis for regular testing is GDPR Art. 32(1)(d), NIS2 Art. 21(2)(f) and DORA Art. 24-25 (packs `eu-gdpr`, `eu-nis2`, `eu-dora`).

## Environment and tooling

The team sets environments up, automates them and keeps them current; it does not just hand the user a list of commands. Method and standards: `practices/environment-setup.md`; procedure: `phases/setup.md`.
- **Inside the repository** (proactive, no extra approval beyond the phase): pinned tool versions, a one-command setup and security target, `.env.example`, devcontainer, pre-commit hooks, CI workflows, dependency-update configuration. These go through the plan and `eng-builder` like any code change.
- **On the user's machine** (installs, upgrades, `docker pull`, global package managers): an outside-repository side effect (rule 7(d) in `SKILL.md`). Ask **once per run** with one consolidated, copy-pasteable command and what it changes; on approval run it yourself, verify each tool's version, and record it in the Log (`- YYYY-MM-DD env: <what was installed or updated>`). Never use `sudo`, `curl | sh` or unofficial sources without showing the exact command and getting a separate yes. On refusal, continue with what exists and say what that limits.
- **Updates**: dependency and toolchain updates are proposed as plan tasks (patch/minor grouped, majors one per task with release notes read), verified by the test suite and a re-scan; never auto-merge, never push.

## Loop-back

When a gate fails back to an earlier phase (test → build, review → build):
(a) append one fix task `F<n>` per Critical/High finding or failing flow to `docs/engineering/plans/plan.md`, each with the acceptance check "the finding or failure no longer reproduces";
(b) set the failing gate to `failed`;
(c) set the target gate and every gate between it and the failing one to `open` (keep a gate a human set to `skipped` as `skipped`), logging `- YYYY-MM-DD reopened: <phase> — <finding ids>`;
(d) set `current_phase` to the target.
Fix tasks run through the normal build flow, including the gate-mode reviewer spot-check.

## Loop counters

One row per loop in state.md → Loop counters, named `<source>→<target>`: the source is a phase (`test`) or a phase and plan task (`build:<task id>`); the target is a phase for a loop-back (`test→build`, `review→build`) or an agent for a re-dispatch inside a phase (`research→eng-researcher`, `architect→eng-architect`, `build:<task id>→eng-builder`, `test→eng-tester`, `document→eng-tech-writer`). Increment on each return, including a return the human chose (see Critical findings). At count 3, stop and escalate to the human in every mode.

## Hard-stop procedure

The single procedure for every hard stop: set the current gate to `failed`, add the Log line `- YYYY-MM-DD hard-stop <phase>: <reason>`, and ask the human how to proceed. The message to the human starts with the literal label `HARD STOP (<phase>): <reason>`, says what was not done, and lists the decision the human must make. It applies in every autonomy mode.

**Resume.** After the human decides, set the gate to `in-progress` and continue, or keep it `failed`. Destructive or outside-repository actions are performed by the human, then the agent is re-dispatched.

Triggers: the four hard stops in rule 7 of `SKILL.md`; any agent line starting `HARD-STOP:` (the reason is the text after the colon).

## Critical findings

A Critical finding (after the severity cap in `shared/findings.md`) never loops automatically. Follow the Hard-stop procedure, and ask the human to choose: fix (loop-back or re-dispatch) or accept the risk (a named human, never while `owner` is `unassigned` or `unknown`). When the human chooses fix, set the failed gate back to `in-progress` and run the loop-back or re-dispatch; that return increments the loop counter like any other. Only High findings loop automatically.
