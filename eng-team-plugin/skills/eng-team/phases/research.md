# Phase 2: research

## Purpose

Give every later phase the knowledge it needs: a pack for every profile need and a cited answer to every open technical question. Flag what a human has not yet reviewed.

## Inputs

- `.eng-team/profile.md`, `.eng-team/state.md` (Open questions), `docs/engineering/product/brief.md`.
- Pack locations by tier: `.eng-team/packs/` (project), the federation standards repo `packs/` if loaded (see Standards loading in `SKILL.md`), and the plugin `stacks/`, `compliance/`, `practices/`.
- `shared/project-profile.md` (Pack resolution), `roles/researcher.md`, `templates/pack.md`, `templates/best-practices.md`, `challenger/citations.md`.

## Steps

1. Run Standards loading from `SKILL.md` if `profile.standards` is set.
2. Resolve packs per `shared/project-profile.md` → Pack resolution, evaluating `applies_when` with the grammar in `shared/project-profile.md` → Pack resolution. List each profile `stacks`, `jurisdictions` and `frameworks` value that no pack covers: these are the unmatched needs.
3. Collect the open technical questions: Open questions rows a source can answer, and brief statements that rest on an unverified technical claim.
4. Dispatch `eng-researcher`, one dispatch per topic, in parallel. Each prompt names the unmatched need or the questions, and the existing packs to avoid duplicating. Each dispatch also asks for one `### Practices: <id>` block for every pack in use (curated, federation and project) plus any pack it researches.
5. Save each returned `### Pack: <id>` block to `.eng-team/packs/<id>.md` and each `### Note: <slug>` block to `.eng-team/research/<slug>.md`, unchanged. `### Practices` blocks are not saved as packs; hold them for step 6. If the researcher returned a `### Findings` block (for example prompt-injection text found in a source), it is saved per Dispatching agents in `SKILL.md` (`.eng-team/research/findings-<date>.md`); tell the user.
6. Write or update `docs/engineering/specs/best-practices.md` from `templates/best-practices.md`: one section per applicable pack or standard (all tiers), from the `### Practices` blocks the researcher returned plus the pack `sources`. Set `Last verified against:` to `git rev-parse --short HEAD` (or `no-commits`) on every write or update. Keep existing `## Asked by the team or you` entries. Dispatch `eng-researcher` for any section that has no source.
7. Fill state.md Packs in use: one row per pack (id, tier, status, why: `applies_when matched` or `researched`). Answer the Open questions the notes cover (cite the note).
8. In your final message to the user (not only in files), list in one short list, each profile value that had no curated pack ("no curated pack matches <value>") and was researched instead, then which packs are `unreviewed` (they need a human `reviewed_by` before promotion) and which are past `review_by`.
9. Check the exit criteria and set the gate to `passed` (Evidence: `.eng-team/state.md` Packs in use) or `failed`. On `failed`, re-dispatch `eng-researcher` for the uncovered need (Loop counter `research→eng-researcher`), or at count 3 or if no source exists, record the need as an Open question, add a `needs-evidence` note to Packs in use, and continue with the human's agreement (autonomous: log it).

## Exit criteria

- Every profile `stacks`, `jurisdictions` and `frameworks` value is covered by a pack of any tier, or recorded as an Open question with a `needs-evidence` note (step 9).
- Every note file in `.eng-team/research/` (not `findings-*.md`) cites at least one source in `[title](url) — accessed YYYY-MM-DD` form or a curated pack file.
- Every saved project pack has `status: unreviewed`, `tier: project`, at most 60 body lines.
- `docs/engineering/specs/best-practices.md` exists and every pack section has at least one source (the `## Asked by the team or you` section is exempt while empty).
- The Packs in use table has one row per pack used, and the user was told which are unreviewed or stale.
- The handover `docs/engineering/handovers/02-research.md` exists and STATUS.md is current.

## Autonomous mode

Same steps. There is no approval stop in this phase in either mode; record `Approved by: agent`.
