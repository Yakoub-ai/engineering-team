# End-to-end smoke test

One tiny idea (a Celsius/Fahrenheit CLI in Node.js) goes through the whole eng-team lifecycle in autonomous mode: init → discover → research → architect → build → test → document → review. Then a script checks the result.

It runs without subagents (roles take turns in one session) and without web access, so it is cheap. Its spend is capped at $3.

```bash
eng-team-plugin/tests/smoke/run-smoke.sh            # fresh temp dir
eng-team-plugin/tests/smoke/run-smoke.sh /some/dir  # keep the output somewhere specific
```

## What it checks (19 checks)
- `.eng-team/profile.md` and `.eng-team/state.md` exist, and all 8 gates are `passed`, `skipped` or `forced`.
- Docs are written: `docs/engineering/product/brief.md`, `docs/architecture.md`, at least one `docs/engineering/decisions/*.md`, `docs/testing.md` and `docs/reviews/*.md`. Each starts with an `Audience:` line.
- The generated converter exists, `node --test` passes, and `100 C` converts to `212`.

## Last result
| Date | Commit | Model | Result |
|---|---|---|---|
| 2026-10-17 | 575a512 | sonnet | 19/19 passed |

Observed behaviour in that run:
- The run was not context-isolated, and the team said so.
- It researched a `node` pack, marked it `unreviewed`, and flagged it for human review.
- It logged its defaults as assumptions A-1 to A-7.
- It left `owner: unassigned` as an open question.
- It added no attribution trailers to commits.
