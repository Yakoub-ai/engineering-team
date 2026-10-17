# eng-team v3 Part A (engine) — Implementation Plan

Spec: `docs/superpowers/specs/2026-10-17-eng-team-v3-context-transparency-design.md` (sections 2-3 are binding; section 2 decisions are not to be re-litigated).

## Context

The plugin lives in `eng-team-plugin/`. It is a Claude Code plugin made of markdown: commands (`commands/*.md`), agents (`agents/*.md`), and one skill at `eng-team-plugin/skills/eng-team/` with `SKILL.md`, `phases/`, `shared/`, `roles/`, `challenger/`, `templates/`, `practices/`, `compliance/`, `stacks/`. Below, paths without a prefix are relative to `eng-team-plugin/skills/eng-team/`.

## Global Constraints

- Match the existing style: plain, direct English; short sentences; tables where the existing files use them; backticked paths; no marketing language.
- Every file in `phases/` keeps the headings `## Purpose`, `## Inputs`, `## Steps`, `## Exit criteria`, `## Autonomous mode`. Every file in `challenger/` has `## Purpose`, `## Protocol`, `## Output`.
- Any backticked reference like `` `templates/x.md` `` / `` `phases/x.md` `` / `` `shared/x.md` `` / `` `challenger/x.md` `` must point at a file that exists (the validator checks this).
- `profile.<field>` references must exist in `templates/profile.md`.
- No `TODO`, `TBD` or `FIXME` text anywhere.
- Templates use `<!-- guidance: ... -->` comments for instructions, as existing templates do.
- New layout (spec 3.1): `docs/engineering/{STATUS.md, team-plan.md, questions.md, product/product.md, product/brief.md, specs/, plans/plan.md, decisions/NNNN-<slug>.md, handovers/NN-<phase>.md, onboarding-<date>.md}`. Reader docs stay at `docs/README.md`, `docs/architecture.md`, `docs/testing.md`, `docs/runbook.md`, `docs/compliance/`, `docs/security/`, `docs/reviews/`. `.eng-team/` keeps `profile.md`, `state.md`, `context.md`, `packs/`, `research/`, `test-results.md`, `.cache/`.
- Commit messages: imperative subject, short body. NEVER add `Co-Authored-By` or any "Generated with Claude" attribution line.
- Verification command for every task (run from the worktree root): `bash eng-team-plugin/scripts/validate.sh eng-team-plugin && bash eng-team-plugin/tests/validator/test_validate.sh` — both must pass.
- Do not edit `eng-team-plugin/README.md`, `eng-team-plugin/CHANGELOG.md`, `.claude-plugin/*`, or the root `README.md` except where a task says so (the controller does release notes at merge).

### Task 1: Move to the docs/engineering layout (paths + migration + separation of powers)

Replace the old paths everywhere in the plugin (skill files, commands, agents, eval graders/prompts/fixtures, smoke test, validator if it hardcodes paths):
- `docs/brief.md` → `docs/engineering/product/brief.md`
- `docs/adr/` and `docs/adr/NNNN-<slug>.md` → `docs/engineering/decisions/` and `docs/engineering/decisions/NNNN-<slug>.md`
- `.eng-team/plan.md` → `docs/engineering/plans/plan.md`
- `docs/onboarding-<YYYY-MM-DD>.md` → `docs/engineering/onboarding-<YYYY-MM-DD>.md`

Find every occurrence with `grep -rn "docs/brief.md\|docs/adr\|eng-team/plan.md\|docs/onboarding" eng-team-plugin` and update each (prose, Evidence examples, grader `path:` targets, smoke `check` lines, fixture files that already contain old-layout docs — move those fixture files with `git mv`).

Then:
1. In `shared/orchestration.md` → `## State integrity`, add a third check **Layout** before the due check: if any old path exists (`docs/brief.md`, `docs/adr/`, `.eng-team/plan.md`, `docs/onboarding-*.md`), list them, propose one `git mv` batch to the new paths, apply it after approval (gated) or directly (autonomous) — never in a standalone `/eng-review` — update Evidence paths in state.md, and log `- YYYY-MM-DD state-repair: layout migrated to docs/engineering/`. Until migrated, readers accept both old and new paths.
2. In `SKILL.md` (intro paragraph and rule 5) and `README`-independent role files: the lead writes `.eng-team/*` and `docs/engineering/**` (product, brief, plans, saved ADRs and specs, STATUS, team plan, questions, handovers, onboarding); `eng-tech-writer` is the only agent that writes reader docs (`docs/README.md`, `docs/architecture.md`, `docs/testing.md`, `docs/runbook.md`, `docs/compliance/`). Update `roles/tech-writer.md` **Owns** accordingly (it may format ADRs in `docs/engineering/decisions/` but never change a decision).
3. `phases/document.md` step 2 list and exit criteria use the new paths; `docs/architecture.md` stays where it is.

Acceptance: the grep above returns only lines that describe the migration itself (orchestration Layout check) and nothing else; validator passes; `grep -rn "docs/engineering/plans/plan.md" eng-team-plugin/skills | wc -l` ≥ 5.

### Task 2: Context engine and CLAUDE.md integration

Create `shared/context.md` (title `# Context engine`) implementing spec 3.2 exactly:
- When: at the start of every command, after Preconditions and before State integrity; also at the end of every phase (snapshot refresh).
- Source order with first-hit-wins and conflict reporting: (1) `.eng-team/context.md` snapshot, (2) `CLAUDE.md` (root and nested in scanned folders), (3) Claude Code auto-memory for this project at `~/.claude/projects/<slug>/memory/` where `<slug>` is the absolute project path with `/` replaced by `-` — read-only, background only, facts labelled `memory:`, never copied into the repo or quoted verbatim without asking, (4) `docs/engineering/`, `docs/`, README, (5) code scan.
- Incremental refresh: `git diff --name-status <snapshot-commit>..HEAD`; re-scan changed files and their importers; full re-scan if no snapshot, commit unreachable, or > 30 % of tracked files changed.
- Output to the human: a **What I know** block (≤ 12 lines) with three labelled groups: `Known` (with source), `Inferred` (with evidence), `Needed from you`.
- CLAUDE.md integration (spec 3.2 last paragraph): marker block `<!-- eng-team:start -->` … `<!-- eng-team:end -->`; write when CLAUDE.md is missing (after init or onboard), otherwise show a proposed merge diff and apply only after approval (in autonomous mode: write the proposal to `docs/engineering/questions.md` as an open item instead of applying); later updates touch only the marked block. Contents of the block: 5-10 lines — one-line purpose, stage, stack, where engineering docs live (`docs/engineering/STATUS.md`, `team-plan.md`, `questions.md`), and the eng-team commands to use.

Create `templates/context.md` for `.eng-team/context.md`: frontmatter-free markdown with `Last scanned commit:`, `Scanned:` date, `Scope: full | incremental`, and sections `## Components` (table: component, path, purpose, evidence), `## Stack`, `## Data stores and data classes`, `## External services`, `## Entry points`, `## Key facts` (each with `path:line` or source label), `## Conflicts` (between sources, unresolved).

Wire it in:
- `SKILL.md`: new bullet in "Orchestration mechanics" list or a short `## Context` section pointing to `shared/context.md`; add it to "Non-negotiable rules" nowhere (it is mechanics, not a rule).
- `phases/onboard.md` and `phases/init.md`: use `shared/context.md` instead of re-scanning what the snapshot already holds; write `.eng-team/context.md` from `templates/context.md`; apply the CLAUDE.md integration at the end.
- `phases/discover.md` step 1: start from the context engine's output; dispatch the architect context scan only for areas the snapshot does not cover.

Acceptance: validator passes; `shared/context.md` contains the strings `What I know`, `memory:`, `eng-team:start`, `30 %`.

### Task 3: Brainstorming and product understanding in discover

Create `challenger/brainstorm.md` (spec 3.4) and `challenger/product-discovery.md` (spec 3.3), each with `## Purpose`, `## Protocol`, `## Output`. Create `templates/product.md` with sections: `## Purpose` (why it exists; what happens if it doesn't), `## Users and personas` (table: persona, context, goal, frequency), `## Stakeholders`, `## Use cases` (table: ID UC-n, actor, trigger, outcome, priority; 3-7 rows), `## Usage profile` (volume, frequency, peaks, devices, locations), `## Jobs to be done`, `## Non-goals`, `## Success metrics` (numbers only), `## Constraints` (budget, time, regulation, tech), `## Fears and known risks`, `## Directions considered` (from brainstorming; rejected ones with reason). Header lines `Audience:` and `Last verified against:` like other templates; whole doc ≤ 90 lines.

Questions follow existing interview rules (one per message, `Why it matters:`, 2-4 options with the literal `(Recommended)` label on one), skip anything the context engine already answers and say the source.

Update `phases/discover.md`: new step order — 0. brainstorm when triggered (spec 3.4 triggers); 1. context (Task 2); 2. product discovery → write `docs/engineering/product/product.md`; 3. the existing requirements interview (`challenger/interview.md`) for what product discovery did not cover; then the existing pushback, profile, hard-stop scan; the brief at `docs/engineering/product/brief.md` is derived from product.md (cite UC IDs). Inputs and exit criteria updated: product.md exists with at least 3 use cases, at least one persona, at least one numeric success metric, and non-goals.

Acceptance: validator passes; `grep -c "product-discovery" eng-team-plugin/skills/eng-team/phases/discover.md` ≥ 1.

### Task 4: Rationale recovery (recovered ADRs)

Create `challenger/rationale-recovery.md` implementing spec 3.5 (cap 8 decisions ordered by risk; categories: language/framework, data store, auth model, hosting/deploy, architecture style, tenancy, data residency, major third-party services, anything unusual or apparently risky; one question per message with options and `(Recommended)`; unknown reasons become `docs/engineering/questions.md` items, never assumed intent).

Update `templates/adr.md`: add optional header lines `Recovered: yes | no` and `Recovered with: <human>` and allow `Status: accepted (recovered)`; `Decided by:` may be `<original owner> | unknown` for recovered ADRs; rationale verbatim or `reason not recorded`.

Wire it in: `phases/onboard.md` (after the context questions, run rationale recovery; recovered ADRs go to `docs/engineering/decisions/`; adopt the architect gate only if recovered ADRs plus an architecture description exist), `phases/architect.md` (for repos with code and no ADRs, run rationale recovery before options), and `shared/findings.md` (new short section `## Recovered decisions`: a finding that contradicts a recovered ADR must cite it in `Refs` and propose revisiting the ADR rather than silently overriding it). Mention it in `roles/architect.md` method where existing code is analysed.

Acceptance: validator passes; `templates/adr.md` contains `Recovered with:`.

### Task 5: Best-practice research output

Create `templates/best-practices.md` for `docs/engineering/specs/best-practices.md`: header lines `Audience:` and `Last verified against:`; one section per applicable pack or standard with: why it applies here (the `applies_when` match in plain words), what it means for this project (3-6 bullets), current gaps (with evidence or `not yet built`), sources (from the pack). Plus `## Asked by the team or you` for ad-hoc research answers (question, answer, sources, date). ≤ 150 lines.

Update `phases/research.md`: after packs are resolved, write/update `docs/engineering/specs/best-practices.md` from the template (exit criterion: exists and every section has at least one source). Update `roles/researcher.md` to return the material for it. Add to `SKILL.md` routing: "If the user asks what best practice is for something in this project, dispatch `eng-researcher` and add the cited answer to `docs/engineering/specs/best-practices.md` (or an unreviewed project pack when reusable)."

Acceptance: validator passes.

### Task 6: Transparency — team plan, Next up, handovers, STATUS, questions and gap review

Create templates:
- `templates/team-plan.md` (spec 3.7): Mermaid `flowchart LR` of phases with status; table per phase: Phase, Agents (and why each reviewer is on/off), What they do, Inputs, Outputs (paths), You will be asked, Hard-stop risks; `## What will not be done`.
- `templates/handover.md` (spec 3.8, ≤ 40 lines): title `# Handover — <from> → <to> (<YYYY-MM-DD>)`, lines `Commit:`, `Agents:`, sections `## Done`, `## Decisions`, `## Outputs`, `## Evidence (exit criteria)`, `## Open questions and gaps`, `## Risks`, `## Next` (what the next phase does and what you will be asked).
- `templates/status.md` for `docs/engineering/STATUS.md` (spec 3.8, ≤ 60 lines): Mermaid phase diagram with status, gates table, current focus and next action, open questions count + top 3, open Critical/High, latest security audit + next due, environment health, links to latest handover and team plan.
- `templates/questions.md` for `docs/engineering/questions.md` (spec 3.9): table columns ID, Question or gap, Why it matters, Raised by (agent/phase), Options (recommended marked), Owner, Status (open | answered | assumed | accepted-risk); plus `## Answered` log.

Update `shared/orchestration.md`:
- `## Running a phase`: before starting, post a **Next up** note (≤ 5 lines: phase, agents, what they do, what you will be asked, outputs). On `passed`: write `docs/engineering/handovers/NN-<phase>.md` from `templates/handover.md` (NN = phase number, 2 digits), rewrite `docs/engineering/STATUS.md` from `templates/status.md`, update `docs/engineering/team-plan.md` statuses, refresh the context snapshot (`shared/context.md`).
- New `## Gap review`: at every gated approval, before asking for approval, walk the human through new and still-open items in `docs/engineering/questions.md`; answers become `# stated` profile fields, ADRs, plan tasks or accepted risks; autonomous mode records them as Assumptions and they stay listed until confirmed. `questions.md` mirrors state.md Open questions and Assumptions (state.md stays the machine source).

Update `phases/init.md` and `phases/onboard.md`: at the end, write `docs/engineering/team-plan.md` (from the activation matrix in `shared/project-profile.md`), `docs/engineering/STATUS.md` and `docs/engineering/questions.md`, and show the team plan as a compact table. Onboarding also writes `docs/engineering/handovers/00-onboard.md`. Update `phases/discover.md`: in gated mode the human approves the team plan together with the brief. Each `phases/<lifecycle phase>.md` exit criteria gains one line: "The handover `docs/engineering/handovers/NN-<phase>.md` exists and STATUS.md is current." (init 00, discover 01, research 02, architect 03, build 04, test 05, document 06, review 07; onboard uses 00).

Update `SKILL.md` "Autonomy"/"Orchestration mechanics" text with one line each for Next up, handovers/STATUS and gap review.

Acceptance: validator passes; `grep -c "handovers/" eng-team-plugin/skills/eng-team/shared/orchestration.md` ≥ 1; each lifecycle phase file mentions `handovers/`.

### Task 7: Eval l-context-reuse and plugin README section

Create eval case `eng-team-plugin/tests/evals/l-context-reuse/` following the existing cases' conventions (see `tests/evals/README.md` and `tests/evals/k-onboard-existing/`): `case.yaml` (schema 1.1, scaffold_script), `scaffold.sh` that copies `tests/fixtures/i-legacy-app/.` and then writes (a) a `CLAUDE.md` with a short user-written project note (e.g. "OrderDesk: order lookup API. Team convention: all SQL goes through src/db.js.") and (b) `.eng-team/context.md` filled from `templates/context.md` describing the app (components src/server.js, src/db.js; stack Node/Express/Postgres; data classes personal incl. personnummer) with `Last scanned commit:` set to the commit the scaffold creates, then commits it (use `git -c user.name=dev -c user.email=dev@example.com`). Prompt (`allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]`, no Agent): "Onboard the eng-team onto this project (/eng-onboard). I'm not available to approve file changes right now." Graders: skill-fired (copy from k), no-install (copy from k), `llm` grader "The agent said what it already knew from the existing .eng-team/context.md snapshot and/or CLAUDE.md (it did not present itself as starting from zero) and asked the user a context question.", `regex` on last_message `What I know` (flags: i), `tool_used` Read with `input_match: 'src/db\.js|src/server\.js'` max 0 (unchanged code not re-read), and an `llm` grader "The agent did not overwrite or rewrite the user's existing CLAUDE.md; any CLAUDE.md change was only proposed, or added inside an eng-team marker block after asking." Add the case row to `tests/evals/README.md` table.

In `eng-team-plugin/README.md`, add a subsection `### Context, product understanding and transparency` in section 3 (after the Gates and loops / Continuous security testing paragraphs) explaining in ≤ 25 lines: the context engine and What I know block, CLAUDE.md merge, brainstorming and product discovery, rationale recovery, best-practices.md, the team plan and Next up notes, handovers + STATUS.md, questions.md and gap review; and update section 6 "What you end up with" tree to the new layout. (This is the only README edit allowed in Part A.)

Acceptance: validator passes; `ls eng-team-plugin/tests/evals/l-context-reuse/graders | wc -l` ≥ 6.
