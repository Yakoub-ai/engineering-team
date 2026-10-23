# Sweep (tiered, standalone)

## Purpose

Fix many independent items in one run: the fixes for a large security audit, or a mechanical refactor across many files. Deterministic tools find the work, Sonnet fixes each item in its own worktree, a separate verifier checks every fix, and Opus plans before and signs off after. Agents return short structured rows, never transcripts, so Opus reads a ledger and a diff instead of a conversation.

It is the default for big sweeps only: an audit remediation plan, or a refactor, with **8 or more independent items** (`/eng-sweep` forces it). Fewer items, single bug fixes and everything else keep the normal build flow or `/eng-security-audit --fix` task by task. Standalone: it never changes gate statuses and appends only a `sweep:` Log line to state.md.

## Inputs

- `.eng-team/profile.md`, `.eng-team/state.md` (the project must be initialised), the context snapshot.
- The request (audit report and `docs/security/` remediation plan, or the refactor description) and optional paths.
- `shared/track.md` → Models per dispatch, `shared/findings.md`, `shared/orchestration.md` → Hand-off contract.
- Roles used: `eng-architect` (Opus), the triage and verify reviewers (`eng-security-engineer` for security items, `eng-qa-engineer` otherwise), `eng-builder`.

## Steps

All sweep files live in `.eng-team/sweeps/<id>/` (`<id>` = `YYYY-MM-DD-<slug>`), written only by the lead (the guard denies agents `.eng-team/**`). Raw tool output stays in `scan/` on disk and is never pasted into a dispatch.

1. **Plan (Opus, before anything runs).** Dispatch `eng-architect` with `model: opus`, read-only, with the request and the repo scope. It returns `### Sweep plan` and nothing else:
   - `kind` (`audit-fix` or `refactor`), `base` (current commit), `Goal` (≤3 lines).
   - **Scan**: the deterministic commands, each read-only (grep patterns, linters, SAST and dependency audit already installed, `git diff --name-only <base>`), and what each yields. For `audit-fix` the audit report is the scan.
   - **Classes**: how an item is classified by path or rule. `sensitive` = auth, crypto, input handling, secrets. `hard-gated` = secrets, auth, migrations, dependencies (lockfiles and manifests). Everything else is `routine`.
   - **Verify**: the exact test, lint and re-scan commands run per item.
   - **Caps**: `max_items` (default 40), `max_parallel` (default 4, hard maximum 6), `max_attempts: 2` (fixed), `max_dispatches` (default `4 × max_items + 10`).
   The lead saves it as `sweep.md` and shows the human the plan, the commands and the caps. The human approves or edits them before anything runs. In `autonomous` the lead records `Approved by: agent`; the caps, the classes and the hard-gate below still apply.
2. **Scan (deterministic).** The lead runs the plan's scan commands itself, writes the raw output to `scan/`, and builds `ledger.md`: one row per candidate item `id | path:line | rule | class | status | attempts | branch`. Items in the same file are chained so that only one runs at a time. If there are more than `max_items`, stop and ask: narrow the scope, raise the cap, or take the highest severity first.
3. **Triage (Sonnet).** Batches of at most 10 items go to the reviewer with `model: sonnet`, in parallel up to `max_parallel`. It returns one row per item, `id | fix, false-positive or escalate | reason in at most 15 words`, then `Scope reviewed:`. `sensitive` items are triaged by Sonnet and nothing cheaper, now and in any later change. Haiku is not used in sweeps: no eval has shown it good enough for triage (Haiku triage stays off until one does). The lead updates the ledger from the rows.
4. **Patch (Sonnet, one worktree per item).** For each `fix` item, dispatch `eng-builder` with `model: sonnet` and `isolation: worktree`, in parallel up to `max_parallel`. The prompt names one item, the branch `eng-sweep/<id>/<item>`, the Verify commands, and "commit locally, never push; add a regression test for a security fix". It returns at most 10 lines: files changed, commit, the check it ran, then the Hand-off `Status:` and `Scope:` lines. A `BLOCKED` or `HARD-STOP` return is recorded; hard stops follow the Hard-stop procedure.
5. **Verify (never the patcher).** For each patched item the lead runs the Verify commands in that worktree itself (tests, lint, re-scan of the rule that flagged it) and writes the item's diff to `diffs/<item>.diff`. An independent reviewer (`model: sonnet`, `gate` mode, read-only, given the diff path) returns findings or "No findings". The item passes only when the checks are green, the re-scan no longer reports it, and there is no High or Critical finding on the changed lines. A fail adds 1 to `attempts`, and the next patch dispatch quotes the failure in one line.
6. **Merge (serial).** In ledger order the lead cherry-picks each passed `routine` or `sensitive` item onto the local branch `eng-sweep/<id>` (cut from `base`) and re-runs the Verify commands after every pick. A conflict or a failure after the pick sends the item back to step 4 against the new head and counts as an attempt; the lead never resolves a conflict by guessing. `hard-gated` items are not picked (step 8).
7. **Escalate, never loop.** An item with 2 failed attempts is not tried again. The lead writes a note of at most 15 lines per item (what failed with the command output or `path:line`, what each attempt changed, one thing not tried) to `diagnosis/<item>.md`, and dispatches `eng-architect` with `model: opus` once, read-only, for all escalated items. It returns per item the cause and `manual-fix`, `redesign` or `drop`, with a concrete recommendation. Each becomes a plan task or an Open question for the human.
8. **Opus sign-off, then the human.** The lead writes the real diff `base..eng-sweep/<id>` and the ledger, and dispatches `eng-architect` with `model: opus`, read-only. It returns `### Sign-off`: `approve` or `changes-needed: <item ids>`, with at most 15 lines of reasons, and a verdict per `hard-gated` item diff. `changes-needed` items are reverted from the branch by the lead and treated as escalated (step 7). `hard-gated` items are merged only after Opus approves their diff **and** a named human approves, in every autonomy mode; migrations are never performed (hard stop 7(c)) and a secret fix leaves rotation to the human.
9. **Land and report.** `gated`: ask the human, then fast-forward the current branch to `eng-sweep/<id>`. `autonomous`: fast-forward after a sign-off with no `changes-needed`. Commits stay local; never push. Remove the worktrees. Report to the human in at most 20 lines: counts (fixed, false-positive, escalated, waiting for approval), the branch, the open `hard-gated` approvals, and the escalation recommendations. Log `- YYYY-MM-DD sweep: <id> <fixed>/<escalated>/<gated>`.

**Caps are hard.** The lead counts dispatches in the ledger header. At `max_dispatches`, stop, report, and ask whether to raise it; never raise it alone. Every return is validated against the Hand-off contract; a malformed return is re-dispatched once, then the item is escalated.

## Exit criteria

- `sweep.md` was approved before the first scan; the caps held.
- Every ledger row has a final status: `fixed`, `false-positive`, `escalated`, `waiting-approval` or `dropped`.
- Every `fixed` item passed Verify by a reviewer other than its patcher, and the Verify commands are green on the integrated branch.
- Opus signed off on the real diff; no `hard-gated` item was merged without Opus approval and a named human.
- No push, no migration run, no secret printed.

## Autonomous mode

Plan approval is recorded as `Approved by: agent`. The caps, the 2-attempt limit, the hard-gate and every hard stop apply unchanged. A `hard-gated` item always waits for a human.
