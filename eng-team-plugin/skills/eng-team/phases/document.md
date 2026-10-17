# Phase 6: document

## Purpose

Produce or update the layered docs set so each audience gets a short doc that matches the code. Existing docs are updated in place; human-written text is kept.

## Inputs

- All artifacts: `docs/engineering/product/brief.md`, `docs/architecture.md`, `docs/engineering/decisions/`, `.eng-team/test-results.md`, `.eng-team/state.md`, packs in use, review findings if any, the code.
- `profile.audiences`.
- `roles/tech-writer.md` and the templates `templates/brief.md`, `templates/architecture.md`, `templates/adr.md`, `templates/testing.md`, `templates/runbook.md`, `templates/evidence-log.md`, `templates/docs-index.md`.

## Steps

1. Run `git rev-parse --short HEAD` and keep the sha (`no-commits` if none).
2. List the docs that already exist under `docs/`, and decide which docs apply: `docs/README.md`, `docs/engineering/product/brief.md`, `docs/architecture.md`, `docs/engineering/decisions/`, `docs/testing.md` (always); `docs/runbook.md` when anything is deployed beyond a local machine; `docs/compliance/evidence-log.md` when the compliance-officer is active.
3. Copy every existing doc to `.eng-team/.cache/docs-before/` (same relative paths). Then dispatch `eng-tech-writer` with `roles/tech-writer.md`, the commit sha, the audiences, the list of applicable docs, the list of docs that already exist, and `.eng-team/test-results.md` plus the latest `docs/security/` report as the sources for `docs/testing.md` (including its Security testing section) and the runbook's Vulnerability response section.
4. Check the returned summary. For each doc that existed before step 3, run `diff` against its snapshot in `.eng-team/.cache/docs-before/` and compare changed lines with the snapshot's line count. If more than 70% of an existing doc's lines changed, send it back to the writer: "Update <doc> in place; keep paragraphs you did not generate." (Loop counter `document→eng-tech-writer`.)
5. Make sure `docs/README.md` lists every doc with its audience (the writer updates it from `templates/docs-index.md`; send it back if a doc is missing).
6. Check each doc's first lines and length; set the gate to `passed` (Evidence: `docs/README.md`) and `current_phase: review`.

## Exit criteria

- Every doc that applies (step 2) exists.
- Each doc starts with `Audience:` and `Last verified against: <sha>` where the sha equals the step 1 value.
- Length limits hold: brief about 60 lines, architecture about 180, each ADR about 60.
- No doc that existed before this run had more than 70% of its lines changed.

## Autonomous mode

Same steps; record `Approved by: agent`.
