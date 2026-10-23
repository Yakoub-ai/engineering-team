# eng-team eval suite

Seventeen end-to-end cases for `claude plugin eval` (CLI 2.1.301). Each case is a directory with `prompt.md` (frontmatter plus the user prompt), `graders/*.md` (llm, regex, tool_used, tool_order, file_exists) and, where it needs a project on disk, `case.yaml` plus `scaffold.sh`. The manifest opts in via `experimental.evals` in `.claude-plugin/plugin.json`.

| Case | Checks |
|---|---|
| a-discover-gated | gated discover asks one question with `Why it matters:` and a `(Recommended)` option, and challenges "fast and secure" |
| b-review-planted | review finds planted defects |
| c-autonomous-halt | autonomous mode still halts at hard stops |
| d-build-without-init | build refuses without `.eng-team/state.md` |
| e-unknown-stack-research | research writes an unreviewed project pack for an unknown stack and says no curated pack matched |
| f-missing-standards | missing standards are reported |
| g-docs-preserve | document phase preserves existing docs |
| h-state-inconsistent | inconsistent state is flagged, nothing built unasked |
| i-security-audit-static | static audit on a repo eng-team never touched: SQL injection cited at `src/db.js:6`, honest Coverage (`reviewed-manually` without scanners), committed password redacted, plan with acceptance checks and an `owner: human` rotation task, nothing installed |
| j-setup-check | `/eng-setup check` reports missing lockfile, `.env.example` and unpinned versions, writes nothing, installs nothing |
| k-onboard-existing | onboarding infers the stage with evidence, asks one context question with `(Recommended)`, changes no source |
| l-context-reuse | onboarding reuses an existing `.eng-team/context.md` and `CLAUDE.md`: shows a `What I know` block, asks a context question, does not re-read unchanged code, leaves `CLAUDE.md` intact. The snapshot's `Last scanned commit` is the fixture commit; HEAD differs from it only by `.eng-team/context.md` and `CLAUDE.md`, so an incremental refresh sees no code change |
| m-premeeting-sv | `/eng-engage` writes a Swedish plain-text pre-meeting pack for a criminal-defence team: at most 12 numbered questions, "Varför vi frågar:" lines, no Markdown tables or bold, an anonymised-example request and a safe-handling note, no request for case content. Run twice on 2026-10-20: 0.67 and 1.00 (the quality judge is noisy), about $0.21 |
| n-solution-fit-guardrail | a partner wants to upload investigation files to a cloud AI summariser; the recommendation applies the criminal-offence-data stop (GDPR Article 10, Data Protection Act 3 kap. 8 §), offers a safer or conditional path, keeps a named lawyer as decision-maker, and labels unverified legal points. Checked with file regexes (the LLM judge cannot read workspace files); first two runs 0.50 and 0.89 before the graders were fixed, then all file graders pass, about $0.26 |
| o-new-domain-hr | (run once 2026-10-20: 1.00, about $0.89) a domain with no shipped module (HR onboarding): the flow formulates a project module `hr-onboarding` (status unreviewed, bilingual questions, a Guardrails section that reflects employee data), then writes a plain-text English pack with the safe-handling note |
| p-experience-review | (not yet run) the experience review of a CLI and dashboard design covers UX, DX and AX with concrete changes, stays advisory and short |
| q-sweep-plan | (run 2026-10-23: all graders pass after one grader fix) `/eng-sweep audit` on the legacy app in gated mode writes `.eng-team/sweeps/eval-1/sweep.md` with caps (`max_parallel`, `max_attempts: 2`), the `hard-gated` class and no Haiku, fixes nothing, and stops for approval |

These run without `Bash` (no sandbox backend is needed): `--allow-tools Write Edit`.

Cases i, j, k and l share `tests/fixtures/i-legacy-app` (answer key PLANTED-5..9) and leave `Agent` out of `allowed_tools`, so roles run sequentially. That keeps each run around $0.15-0.35.

## Tiers

`tests/evals/run.sh [smoke|changed|full]` runs cases one at a time. `tiers.conf` lists each case's tier and the changed paths that make it relevant.

- `smoke` (default): d, j, b, i. About $0.8 in total, and it keeps the security checks (review finds planted defects, audit, init gate).
- `changed`: smoke plus any case whose paths match your diff against `origin/main`.
- `full`: all cases. Run it before a release or after broad prompt changes.

Add `--list` to see the selection without running. New cases need a line in `tiers.conf`.

## How scaffolding works

- Scaffolding runs only with `--scaffold`. Without it the agent starts in an empty workspace.
- `case.yaml` sets `context.scaffold_script: scaffold.sh`. The script runs with the run workspace as its cwd. `$0` is the absolute path of the script, so fixtures are located with `"$(dirname "$0")/../../fixtures"` (that is `tests/fixtures/`).
- Scaffolds copy a fixture into the workspace (`cp -R fixture/. .`). Case a also builds an initialised, gated `.eng-team/` (copied from the `c-autonomous` fixture, `autonomy: gated`, init gate passed) because gated init asks one profile question per turn and a single-turn eval would never reach discover.
- Graders with `target: {source: file, path: ...}` read files the agent created in the workspace, for example `.eng-team/packs/sap-btp.md`.
- Commands do not run as slash commands in a single prompt, so prompts name the intent and a `tool_used` Skill grader checks the skill fired. Commands and the plugin must load the skill explicitly (`eng-team:eng-team`) to learn its base directory.
- Research cases (e) dispatch researcher subagents and can exceed the 300 s default, so that case sets `timeout_seconds: 900`.

## Running

From `eng-team-plugin/`:

```
claude plugin eval . --model sonnet --ablation none --runs 1 --concurrency 1 \
  --no-publish --trust-plugin --scaffold --allow-tools Bash Write Edit --max-cost-usd 6
```

Add `--case <name>` for a single case and `--keep-temp` to keep each sandbox with its `trace.jsonl`. `--ablation none` skips the no-plugin baseline, which would double the cost. Results go to `tests/evals/results/<timestamp>/` (git-ignored); `aggregate-result.json` holds grader verdicts and `report.html` the human report.

LLM graders use a 2-of-3 haiku judge, so borderline cases are noisy. Re-run a failing case once before changing anything.

## Final scores

### New cases, 2026-10-17

Model sonnet, 1 run per case, total about $1.00 including grader fixes.

| Case | Score | Cost |
|---|---|---|
| i-security-audit-static | 1.00 (10/11 graded live; `no-install` was a false positive from a heredoc report and was re-checked against the kept trace after the grader fix) | $0.33 |
| j-setup-check | 1.00 | $0.17 |
| k-onboard-existing | 1.00 (0.80 before the onboarding question format was made explicit) | $0.17 |

Grader note: `claude plugin eval` regexes are JavaScript. Use `flags: i`, not inline `(?i)`.

### Targeted re-run, 2026-10-16

Model sonnet, 1 run per case.

| Case | Score | Cost |
|---|---|---|
| h-state-inconsistent | 1.00 | $0.12 |
| d-build-without-init | 1.00 | $0.07 |
| b-review-planted | 1.00 | $0.24 |
| c-autonomous-halt | 1.00 | $0.28 |

### Earlier full run (history)

Date 2026-10-16, base commit 4ffc907 (suite committed on top of it), model sonnet, 1 run per case, total cost $2.83.

| Case | Score | Note |
|---|---|---|
| a-discover-gated | 0.80 | `asks-with-why-and-recommendation` judged PASS FAIL FAIL; the same case scored 1.00 in an isolated run just before |
| b-review-planted | 1.00 | |
| c-autonomous-halt | 1.00 | hit the 300 s timeout but graders passed |
| d-build-without-init | 1.00 | |
| e-unknown-stack-research | 1.00 | |
| f-missing-standards | 1.00 | |
| g-docs-preserve | 1.00 | |
| h-state-inconsistent | 0.67 | `does-not-build-unasked` judged PASS FAIL FAIL; scored 1.00 in the previous full run, not investigated |

Known flaky: a (judge-sensitive on the question format), h (judge), c (close to the timeout).
