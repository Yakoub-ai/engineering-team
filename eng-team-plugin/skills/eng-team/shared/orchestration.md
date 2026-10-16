# Orchestration mechanics

Loaded by `SKILL.md`. These are the orchestrator's own procedures for state, entry, loops and hard stops. Only the orchestrator writes `.eng-team/state.md` (including in the sequential fallback).

## State integrity

Runs on every start when `.eng-team/state.md` exists (skip it when there is no state). List every mismatch to the user, then repair (except in a standalone `/eng-review`: report mismatches only, never repair):
1. **Artifacts.** For each gate with status `passed`, check that its Evidence artifact exists. If it is missing, the repair is: set that gate to `open` and log `- YYYY-MM-DD state-repair: <phase> artifact missing`.
2. **Phase.** The expected phase is the first phase, in Phases-table order, whose gate is not `passed`, `skipped` or `forced` (if none, the project is complete and `current_phase` should be `review`). If `current_phase` differs, the repair is: set `current_phase` to the expected phase and log `- YYYY-MM-DD state-repair: current_phase <old> → <new>`.
- Standalone `/eng-review`: report mismatches only; do not modify state.md, apart from the `adhoc-review:` Log line.
- `gated`: ask the human before each repair and apply what they choose.
- `autonomous`: apply the repairs and log them.
Never delete rows from state.md; change statuses and append Log lines only.

## Entry

`/eng` resumes from `current_phase` and runs phases in order. `/eng-<phase>` and `/eng-promote` run only after the Preconditions in `SKILL.md` hold. `/eng-<phase>` runs one phase and refuses, naming the blocking gate, unless every earlier gate is `passed`, `skipped` or `forced`.
- `--force "<reason>"` runs the phase anyway: set each earlier gate that is not `passed|skipped` to `forced` and log `- YYYY-MM-DD forced <phase>: <reason>`. `--force` without a reason string is refused. It is logged in either autonomy mode.
- A gate becomes `skipped` only when a human runs a phase command with `--skip "<reason>"` in gated mode; log `- YYYY-MM-DD skipped <phase>: <reason>`. In autonomous mode `--skip` is refused.
- Exception: `/eng-review` invoked directly never refuses and never changes gates (see Preconditions in `SKILL.md`).

## Running a phase

Set its gate to `in-progress`, follow its file, then check every exit criterion yourself. Never trust an agent's "done". All pass → `passed` (with evidence, approver, date) and advance `current_phase`. Any fail → `failed`.

## Loop-back

When a gate fails back to an earlier phase (test → build, review → build):
(a) append one fix task `F<n>` per Critical/High finding or failing flow to `.eng-team/plan.md`, each with the acceptance check "the finding or failure no longer reproduces";
(b) set the failing gate to `failed`;
(c) set the target gate and every gate between it and the failing one to `open` (keep a gate a human set to `skipped` as `skipped`), logging `- YYYY-MM-DD reopened: <phase> — <finding ids>`;
(d) set `current_phase` to the target.
Fix tasks run through the normal build flow, including the gate-mode reviewer spot-check.

## Loop counters

One row per loop in state.md → Loop counters, named `<source>→<target>`: the source is a phase (`test`) or a phase and plan task (`build:<task id>`); the target is a phase for a loop-back (`test→build`, `review→build`) or an agent for a re-dispatch inside a phase (`research→eng-researcher`, `architect→eng-architect`, `build:<task id>→eng-builder`, `test→eng-tester`, `document→eng-tech-writer`). Increment on each return, including a return the human chose (see Critical findings). At count 3, stop and escalate to the human in every mode.

## Hard-stop procedure

The single procedure for every hard stop: set the current gate to `failed`, add the Log line `- YYYY-MM-DD hard-stop <phase>: <reason>`, and ask the human how to proceed. It applies in every autonomy mode.

**Resume.** After the human decides, set the gate to `in-progress` and continue, or keep it `failed`. Destructive or outside-repository actions are performed by the human, then the agent is re-dispatched.

Triggers: the four hard stops in rule 7 of `SKILL.md`; any agent line starting `HARD-STOP:` (the reason is the text after the colon).

## Critical findings

A Critical finding (after the severity cap in `shared/findings.md`) never loops automatically. Follow the Hard-stop procedure, and ask the human to choose: fix (loop-back or re-dispatch) or accept the risk (a named human, never while `owner` is `unassigned` or `unknown`). When the human chooses fix, set the failed gate back to `in-progress` and run the loop-back or re-dispatch; that return increments the loop counter like any other. Only High findings loop automatically.
