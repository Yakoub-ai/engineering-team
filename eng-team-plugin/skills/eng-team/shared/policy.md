# Repo policy and autonomous mode

Loaded by `SKILL.md`, `phases/init.md`, `phases/onboard.md` and `/eng-policy`. The plugin's hooks enforce everything here; this file tells you how to work with them. Never try to get around a guard denial: tell the user what was blocked and why.

## The policy file

`.eng-team/policy.json` is committed, can only add to the plugin's fixed security baseline, and is read by the guard on every call:

```json
{
  "version": 1,
  "max_mode": "gated",
  "human_required_paths": [".azure-pipelines/**", "databricks.yml", "**/auth/**"],
  "destructive_extra": ["databricks bundle destroy", "make reset-db"],
  "credentials_scoped": false,
  "approval_ttl_hours": 24
}
```

- `max_mode`: `gated` | `autonomous`, the highest mode any run in this repo may use.
- `human_required_paths`: changes under these globs always need human approval at the next gate, in both modes. List them in the gate summary.
- `destructive_extra`: commands the guard blocks in addition to the baseline (a plain substring of the command).
- `credentials_scoped`: `true` only when the credentials Claude can reach have no prod, delete or permission-change rights. It is a statement by the human; never set it yourself.
- `approval_ttl_hours`: how long a queued approval stays valid.

A missing or invalid file means gated with autonomous mode off; the SessionStart hook warns the user.

## Setup (init, onboard, or `/eng` when the file is missing)

1. Infer the stack from the repo. Propose `human_required_paths` from what exists: CI and pipeline files, IaC, auth code, deploy configs, env samples. Propose `destructive_extra` from the stack packs (for example `databricks bundle destroy`, `wp db reset`).
2. Ask at most two questions, one per message, each with a `(Recommended)` option: the highest mode this repo may use (recommend `gated`), and whether to add or drop any proposed path.
3. Write `.eng-team/policy.json` with the Write tool. Creating it is allowed once; a `max_mode` of `autonomous` makes Claude Code ask the user to confirm.
4. Print, do not run:
   - a CODEOWNERS line protecting `.eng-team/policy.json` and `.claude/`, with branch protection or required reviewers for the default branch (`az repos policy …` for Azure DevOps, repository rules for GitHub);
   - the stack's least-privilege checklist: a dev-only service principal or service account with read-only or no delete/permission rights for unattended runs (Databricks, Azure, GCP), and a note that purely local projects need nothing.
5. Tell the user in one line that they can change the policy later with `/eng-team:eng-policy`.

## Changing the policy (`/eng-team:eng-policy`)

The user typing `/eng-team:eng-policy` opens a 30-minute window in which you may edit the file. Show the current policy, make the change the user asked for, and show the diff. The guard validates the result. A change that tightens the policy goes through; one that loosens it (raising `max_mode`, removing a path or command, setting `credentials_scoped` to true, a longer TTL) makes Claude Code ask the user, and is denied when the session runs unattended (`bypassPermissions`, `dontAsk`). Outside the window, or for any subagent or shell command, edits are denied. A plain chat message that names the policy (for example "block make reset-db in the policy") also opens the window for tightening changes; loosening still asks. Autonomous mode, raising `max_mode` by shell, and approval-queue entries stay command-only.

## Activating autonomous mode

Only the user can start it, by typing `--autonomous` (or `--auto`) on an eng-team command. When `state.md` already says `autonomy: autonomous` (the user activated it earlier) and the policy still allows it, continue without asking again; if the policy no longer allows it, set `autonomy: gated` and say why. Otherwise:
1. If `policy.json` is missing or invalid, or `max_mode` is `gated`, say so and continue gated; offer `/eng-team:eng-policy`.
2. Otherwise ask one question before anything else, with the AskUserQuestion tool when available: **"Activate autonomous mode for this run?"** Options `Yes, run autonomously` and `No, stay gated (Recommended)`. List the risks first, in at most 5 lines:
   - no approval stops at discover, architect and review: agents decide and record ADRs with `Decided by: agent`;
   - interview questions become Assumptions you review later;
   - destructive actions, pushes and deploys still stop for you;
   - changes under `human_required_paths` still wait for your approval;
   - when `credentials_scoped` is false: "the credentials this session can reach are not scoped; a missed guard pattern could act with your full rights".
3. On yes, set `autonomy: autonomous` in `.eng-team/state.md` (and the profile when the user asked for it to stick). The guard allows that edit only when the user typed the flag this session and the policy allows it. On no, no answer, or a guard denial, stay gated.
