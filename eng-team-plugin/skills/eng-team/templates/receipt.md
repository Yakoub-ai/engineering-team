# Change receipt — <run or phase> (<YYYY-MM-DD>)

Commit: <sha range, e.g. abc123..def456>
Mode: <gated | autonomous> (policy max_mode: <gated | autonomous>)
<!-- guidance: written by the lead to docs/engineering/receipts/<YYYY-MM-DD>-<run>.md whenever a run changed code (any eng-builder or eng-tester dispatch), and refreshed before every stop. It is the audit trail and the PR description: paste it as is. At most 60 lines; link instead of copying. The Stop hook checks that the four marked sections exist, that Verified holds at least one `command` with its result, and that every pending queue id is listed. -->

## Objective
<!-- guidance: one or two lines: what was asked, in the user's words. -->

## Changed
<!-- guidance: one bullet per task: task id, files or modules, one line on the change. -->

## Verified
<!-- guidance: required. One bullet per check you ran and observed yourself: `command` → result (pass count, exit code). Never a check an agent only reported. -->

## Not verified
<!-- guidance: required. What was not checked and why (no staging, no credentials, DAST not run). "none" only if truly nothing. -->

## Decisions
<!-- guidance: ADR links and agent decisions (Decided by: agent) made in this run, or "none". -->

## Risks
<!-- guidance: open findings by id and severity, accepted risks with the human's name, findings the verifier rejected (count), or "none". -->

## Approvals needed
<!-- guidance: required. Every approval queue entry of this run as `Q-<n> | status | command`, changes under human_required_paths waiting for approval, and gate approvals pending. "none" only if the queue has no pending entry. -->
