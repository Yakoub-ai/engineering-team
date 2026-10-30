# First-run tour

Used by `/eng-team:eng-init` (offered on a first gated init, or on its own with `--tour`). Read-only: explain, never change files, gates, policy or autonomy. One card at a time, each at most 6 lines. After each card ask: continue, jump to a topic, or skip. Skip ends the tour at once.

## Pick the track

Inspect, without writing: `.eng-team/state.md`, `.eng-team/policy.json`, whether the repo has application code.
- No `.eng-team/` and no code: **new project** track. Cards 1-4, then continue with init (or, with `--tour`, say to run `/eng-team:eng-init`).
- No `.eng-team/` but code exists: **existing project** track. Cards 1-4, then say to run `/eng-team:eng-onboard`, which scans the existing code first.
- `.eng-team/state.md` exists: **returning** track. Report the current phase and gates in two lines, then cards 3-8.

## Cards

1. **What you get.** A lead plus specialist agents that interview, research with citations, architect, build, test, document and review. Security outranks everything else; every claim cites evidence.
2. **Pick your effort.** `/eng` sizes the work: tier S (script), M (service), L (regulated or sensitive). Override with `--tier S|M|L`. Default mode is **gated**: you approve each phase.
3. **The few commands that matter.** `/eng` (whole lifecycle, safe to re-run), `/eng-review` and `/eng-security-audit` (work on any repo, no setup), `/eng-setup` (environment), `/eng-sweep` (big jobs). Type `/eng-team:` to list all.
4. **Your profile is the scope contract.** `.eng-team/profile.md` decides reviewers and regulations. A wrong `data_classes` silently skips GDPR. Commit `.eng-team/` so teammates share it.
5. **Safety rules you control.** `.eng-team/policy.json` holds `max_mode`, protected paths and extra blocked commands. Destructive actions (force push, hard reset, infra apply/destroy, cloud deletes, secret changes) are always yours to run. Change policy only through `/eng-team:eng-policy`.
6. **Approvals and overrides.** A denied command lands in the queue: run it yourself, then type `/eng-team:eng-queue done Q-<n>`. To skip or force a gate, type `--skip "<reason>"` or `--force "<reason>"` yourself; Claude cannot grant these to itself. `--autonomous` always asks you to confirm.
7. **Proof of work.** Every code-changing run ends with a change receipt in `docs/engineering/receipts/`; paste it as the PR description. A separate verifier tries to disprove each finding before it sends work back.
8. **See and share it.** `/eng-view` opens a local workspace on 127.0.0.1 (search, map, in-place doc edits). `/eng-present` builds an offline cheatsheet, brief, product summary and 16:9 deck into `docs/present/`. Both need Node 18+; `/eng-team:eng-init --tour` re-checks what is missing.

## Closing card

Say: "Start with `/eng-team:eng-init` (new) or `/eng-team:eng-onboard` (existing), then `/eng`. Replay this with `/eng-team:eng-init --tour` any time. Silence the first-run notice with `ENG_TEAM_NO_WELCOME=1`."
