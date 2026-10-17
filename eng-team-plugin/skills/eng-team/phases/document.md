# Phase 6: document

## Purpose

Produce or update the layered docs set so each audience gets a short doc that matches the code. Existing docs are updated in place; human-written text is kept.

## Inputs

- All artifacts: `docs/engineering/product/brief.md`, `docs/architecture.md`, `docs/engineering/decisions/` (read-only for the writer), `.eng-team/test-results.md`, `.eng-team/state.md`, packs in use, review findings if any, the code.
- `profile.audiences`.
- `roles/tech-writer.md` and the templates `templates/architecture.md`, `templates/adr.md`, `templates/testing.md`, `templates/runbook.md`, `templates/evidence-log.md`, `templates/docs-index.md`.

## Steps

1. Run `git rev-parse --short HEAD` and keep the sha (`no-commits` if none).
2. The lead owns the brief: set `Last verified against: <sha>` in `docs/engineering/product/brief.md` to the step 1 sha, changing no other line. Do this before dispatching the writer.
3. List the docs that already exist under `docs/`, and decide which docs apply: `docs/README.md`, `docs/architecture.md`, `docs/testing.md` (always); `docs/runbook.md` when anything is deployed beyond a local machine; `docs/compliance/evidence-log.md` when the compliance-officer is active.
4. Copy every existing doc to `.eng-team/.cache/docs-before/` (same relative paths). Then dispatch `eng-tech-writer` with `roles/tech-writer.md`, the commit sha, the audiences, the list of applicable docs, the list of docs that already exist, and `.eng-team/test-results.md` plus the latest `docs/security/` report as the sources for `docs/testing.md` (including its Security testing section) and the runbook's Vulnerability response section.
5. Check the returned summary. For each doc that existed before step 4, run `diff` against its snapshot in `.eng-team/.cache/docs-before/` and compare changed lines with the snapshot's line count. If more than 70% of an existing doc's lines changed, send it back to the writer: "Update <doc> in place; keep paragraphs you did not generate." (Loop counter `document→eng-tech-writer`.)
6. Make sure `docs/README.md` lists every doc with its audience (the writer updates it from `templates/docs-index.md`; send it back if a doc is missing).
7. Check each doc's first lines and length; set the gate to `passed` via Running a phase in `shared/orchestration.md` (handover, STATUS, team plan first) (Evidence: `docs/README.md`) and `current_phase: review`.

## Exit criteria

- Every doc that applies (step 3) exists.
- Each doc, and the brief (refreshed by the lead in step 2), starts with `Audience:` and `Last verified against: <sha>` where the sha equals the step 1 value.
- Length limits hold: brief about 60 lines, architecture about 180, each ADR about 60.
- No doc that existed before this run had more than 70% of its lines changed.
- The handover `docs/engineering/handovers/06-document.md` exists and STATUS.md is current.

## Autonomous mode

Same steps; record `Approved by: agent`.
