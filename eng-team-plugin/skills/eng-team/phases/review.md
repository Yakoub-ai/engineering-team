# Phase 7: review

## Purpose

Run the activated specialist reviewers, merge their findings into one ranked report, and close the lifecycle: no open Critical/High, or each one accepted by a named human.

## Inputs

- `.eng-team/profile.md` and `.eng-team/state.md`, or an in-memory profile when `.eng-team/` does not exist.
- The repository (or the diff, in `gate` mode).
- `.eng-team/research/findings-*.md` if present (researcher and architect findings): merge them into the consolidation in step 5.
- `shared/project-profile.md` (activation matrix), `shared/findings.md`, the role files in `roles/`, packs in use, `roles/lead-architecture.md`.

## Steps

1. **Pick the mode.**

   | Mode | Trigger | Scope |
   |---|---|---|
   | `plan` | New project, design doc, "what do we need before launch" | Produce a scoped requirements list per stage gate. No code needed. |
   | `review` | Existing repo / app audit | Full audit of the repo against activated roles. |
   | `gate` | PR, diff, branch, "check this change" | Only the diff + files it touches; only roles whose triggers the diff hits. |

   If unclear, ask once. If the user is away, default to `review` when a repo is present, else `plan`. Inside the `/eng` pipeline the mode is `review`. `/eng-review` invoked directly is standalone: it never changes gate statuses, writes the report, and, if `.eng-team/state.md` exists, appends the Log line `- YYYY-MM-DD adhoc-review: <mode> <scope>`. Only the `/eng` lifecycle reaching phase 7 sets the review gate; steps 7 and 8 below then apply.
2. **Profile.** With `.eng-team/`, use `.eng-team/profile.md`. Without it, build an in-memory profile as v1 did: read `templates/profile.md`, infer from the repo first (manifests, IaC, CI files, README, env samples), ask the user only for what changes the outcome (usually data classes, regulated status, stage), and show it in a compact block before dispatching. Do not write `.eng-team/` in this case; accepted risks then go only in the report.
3. **Activate roles** with the matrix in `shared/project-profile.md`. Always-on: `security-engineer`, `compliance-officer`, `qa-engineer`. Resolve packs per `SKILL.md` → Pack resolution and pass the matching ones to every role.
4. **Dispatch** the `eng-<role>` reviewers in parallel per `SKILL.md` → Dispatching agents. Run the `roles/lead-architecture.md` checks yourself. In the lifecycle, read the latest `docs/security/security-audit-*.md`; if its commit differs from HEAD, re-run the audit layers for what changed (static always; DAST when the profile allows it) and add a Security audits row with Trigger `lifecycle-review`. In a standalone `review`, if any scanners from `phases/security-audit.md` step 3 are installed, run its static layer (step 4) first and give the raw-output directory to `eng-security-engineer`; report each layer in the Not covered section as scanned or not-run. For live testing, recommend `/eng-security-audit dast` or `full`.
5. **Consolidate.** Dedupe (same root cause → one finding, list all roles). Resolve conflicts with the priority order and note the trade-off. Re-open the cited evidence for every Critical/High; drop or downgrade anything that does not hold up. Apply the unreviewed-pack severity cap. Rank by severity, then effort.
6. **Report.** Use the report template in `shared/findings.md` and write it to `docs/reviews/eng-review-<YYYY-MM-DD>.md`, or into the reply when tools don't allow writing. In `plan` mode output requirements grouped by stage gate (before pilot / before production / before scale), each with owner role and acceptance criterion.
7. **Close.** (Lifecycle only; a standalone review stops after the report and lists open findings.) For each open High: loop back to the build phase per Loop-back in `shared/orchestration.md` (Loop counter `review→build`), or the human accepts it as a risk. For each Critical (after the severity cap): follow Critical findings in `shared/orchestration.md` (Hard-stop procedure; the human chooses fix via loop-back or accepts the risk); never loop automatically. An accepted risk is a row in state.md Accepted risks with the human's name, date and a review-on date. Risks cannot be accepted while `owner: unassigned` or `unknown`; ask for an owner first.
8. Gated: ask the human to approve the final verdict and record approver and date. Set the gate to `passed` (Evidence: report path).

## Exit criteria

- The report exists and has a "Not covered" section.
- No open Critical or High, or each remaining one is a row in Accepted risks with a human name (not `agent`), date and review-on date.
- `profile.owner` is not `unassigned` or `unknown` if any risk was accepted.
- Gated: a human name and date are recorded as approver of the review gate.

## Autonomous mode

You cannot accept risks yourself. Loop High findings back to build; stop and ask the human for every Critical, and for any High remaining after 3 loops. Otherwise record `Approved by: agent`.
