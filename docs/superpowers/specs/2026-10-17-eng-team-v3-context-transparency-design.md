# eng-team v3 — Context, Product Understanding & Transparency — Design Spec

Date: 2026-10-17 · Status: draft for human review · Base: v2.3.0 (`cd619df`)

## 1. Context

v2.3 can run a gated lifecycle, audit security, set up environments and onboard existing projects. What it does not yet do well:

- It re-scans projects from scratch even when Claude Code already knows them (CLAUDE.md, auto-memory, earlier scans).
- Discovery challenges requirements but does not build a full **product understanding** (why the project exists, for whom, how it is used).
- For existing code it never asks **why** things were built the way they are, so it can "fix" deliberate trade-offs.
- The human cannot see **which agents run in which phase, and when**, before work starts.
- Handover between agents goes through files, but there is **no human-readable handover record** or overview.
- Specs and plans are split between `.eng-team/` (hidden machine state) and `docs/`, and open questions live in a state table nobody reads.

Goal: an engine that starts from understanding (purpose, users, use cases, rationale), reuses what is already known, shows its plan of work up front, records every handover readably, discusses every gap with the human, and carries a project from brainstorming to production grade.

## 2. Decisions taken with the human (do not re-litigate)

| # | Decision | Choice |
|---|---|---|
| D1 | Where human-readable engineering docs live | `docs/engineering/` (`.eng-team/` stays machine state) |
| D2 | Handover format | One handover file per phase + a rolling `STATUS.md` |
| D3 | Context sources | Repo files (CLAUDE.md, `.eng-team/`, `docs/`, README) with a context snapshot for incremental re-scans; Claude auto-memory read-only; write CLAUDE.md when missing, **propose a merge** when it exists |
| D4 | Rationale recovery depth | Significant + risky decisions only (typically 3-8 questions), recorded as recovered ADRs |
| D5 | Visual map | Explicit links + local embeddings (no API key, content never leaves the machine) |
| D6 | Viewer editing | Docs editable in the browser; code view-only (code changes go through the team's gates) |
| D7 | Agent context | Same index exposed to agents through a local MCP server |
| D8 | Sequencing | Part A (engine) first; Part B (viewer + index + MCP) as its own spec and plan afterwards |

## 3. Part A — Engine

### 3.1 Project layout (in the target project)

```
docs/
  engineering/
    STATUS.md              rolling overview (lead writes)
    team-plan.md           agents per phase, what/when/outputs/human touchpoints
    questions.md           open questions, gaps, assumptions to confirm
    product/
      product.md           purpose, users/personas, use cases, usage, non-goals, metrics
      brief.md             (moved from docs/brief.md)
    specs/
      best-practices.md    standards that apply to this project and why
      <date>-<topic>.md    design specs (architect output beyond architecture.md)
    plans/
      plan.md              implementation plan (moved from .eng-team/plan.md)
    decisions/
      NNNN-<slug>.md       ADRs incl. recovered ones (moved from docs/adr/)
    handovers/
      NN-<phase>.md        one per completed phase
    onboarding-<date>.md   (moved from docs/onboarding-<date>.md)
  README.md · architecture.md · testing.md · runbook.md      reader docs (unchanged)
  compliance/ · security/ · reviews/                          (unchanged)
.eng-team/  profile.md · state.md · context.md · packs/ · research/ · test-results.md · .cache/
```

Why this split: `docs/engineering/` is the *process record* (why, plan, decisions, handovers) that reviewers read in PRs; `docs/` top level keeps the *reader docs* that describe the running system. `.eng-team/` stays machine state so humans are not asked to read tables of loop counters.

**Migration** (existing v2 projects): State integrity detects old paths (`docs/brief.md`, `docs/adr/`, `.eng-team/plan.md`, `docs/onboarding-*.md`). It proposes one `git mv` batch, applies it after approval (gated) or directly (autonomous), and updates Evidence paths in state.md. Until migrated, readers accept both paths.

### 3.2 Context engine (`shared/context.md`, new)

Runs at the start of every command (after Preconditions, before State integrity) and produces a short **"What I know"** block for the human: known / inferred / needed.

Source order (first hit wins per fact; conflicts are reported, never silently resolved):
1. `.eng-team/context.md` — the context snapshot: last scanned commit, components map, stack, data stores, external services, entry points, key facts with `path:line`, unresolved conflicts.
2. `CLAUDE.md` (project, and nested ones in scanned folders).
3. Claude Code auto-memory for this project (`~/.claude/projects/<slug>/memory/`), **read-only**, treated as background: never copied into the repo or shown verbatim without asking; facts from it are labelled `memory:`.
4. `docs/engineering/`, `docs/`, README.
5. Code (scan).

Incremental refresh: if a snapshot exists, run `git diff --name-status <snapshot-commit>..HEAD`; re-scan only changed areas plus anything they import. Full re-scan when no snapshot, the snapshot commit is unreachable, or more than 30 % of files changed. Update the snapshot after each phase.

**CLAUDE.md integration** (D3): after onboarding or init, if no CLAUDE.md exists, write one with a short project summary and pointers to `docs/engineering/` inside markers `<!-- eng-team:start -->` / `<!-- eng-team:end -->`. If one exists, show a proposed diff that merges the summary into it (no duplicate facts, keep the user's wording) and apply only after approval. Later updates touch only the marked block.

### 3.3 Product understanding (discover, extended)

New `challenger/product-discovery.md` and `templates/product.md`. Discover runs it before the requirements interview. Sections: purpose (why it exists, what happens if it doesn't), users and personas, stakeholders, use cases (top 3-7, each with actor, trigger, outcome), usage profile (volume, frequency, peak, devices, locations), jobs-to-be-done, non-goals, success metrics (numbers), constraints (budget, time, regulation, tech), risks the human already fears.

Questions follow the existing rules (one per message, `Why it matters:`, options with `(Recommended)`), skip what context already answers, and say where an inference came from. Output: `docs/engineering/product/product.md` (≤ 90 lines), then the brief (`product/brief.md`) is derived from it.

### 3.4 Brainstorming (discover step 0)

New `challenger/brainstorm.md`. Triggers when the request is an idea rather than a defined product (no users, no use case, or "I want to build something that…"), or on request. Protocol: restate the idea; diverge (3-5 materially different directions, including "don't build: buy/configure"); converge with the human on one using purpose, users and constraints; record rejected directions in `product.md` → "Directions considered". Then continue with product discovery.

### 3.5 Rationale recovery (onboard + architect on existing code)

New `challenger/rationale-recovery.md` (D4). Identify significant or risky decisions visible in the code and config: language/framework, data store, auth model, hosting/deploy, architecture style, tenancy, data residency, major third-party services, and anything unusual or apparently risky (e.g. no auth on an endpoint, data in an unexpected region). Cap at 8; order by risk. For each, ask the human one question: what was decided, why, what alternatives were considered, whether it still holds. Record each as a **recovered ADR** in `docs/engineering/decisions/` (`Status: accepted (recovered)`, `Decided by: <original owner or unknown>`, `Recovered with: <human>`, rationale verbatim or `reason not recorded`). Unknown reasons become `questions.md` items, not assumptions about intent. Reviewers treat a recovered ADR's stated trade-off as context: a finding against it must say so and propose revisiting the ADR, not silently override it.

### 3.6 Best-practice research (research phase, extended)

Research writes `docs/engineering/specs/best-practices.md`: each applicable pack/standard (stack, compliance, practices), why it applies to *this* profile (`applies_when` in plain words), what it concretely means here (3-6 bullets), current gaps, and sources. The human can ask the team to research any topic at any time ("what's best practice for X here?"); the answer is added to this file with citations, or as an unreviewed project pack when it is reusable.

### 3.7 Team plan & transparency

New `templates/team-plan.md`. Written after init/onboard, updated at every gate. Content:
- A Mermaid phase diagram with current status.
- One row per phase: agents (and why each reviewer is activated or not, from the activation matrix), what they do, inputs, outputs (paths), human touchpoints (questions, approvals), hard-stop risks.
- "What will not be done" (out of scope, human-only actions).

Shown to the human as a compact table before the first phase; gated mode asks for approval of the team plan together with the brief. Before every phase, the lead posts a **Next up** note (≤ 5 lines: phase, agents, what they will do, what you will be asked, expected outputs).

### 3.8 Handovers & STATUS (D2)

New `templates/handover.md`: from → to, date, commit, agents run, what was done, decisions (ADR links), outputs (links), evidence for the exit criteria, open questions and gaps (links into `questions.md`), risks (finding IDs), what the next phase will do and what the human will be asked. Written by the lead at every gate transition to `docs/engineering/handovers/NN-<phase>.md` (≤ 40 lines). Standalone commands (audit, setup, review, onboard) write a handover only when they change project direction (e.g. onboarding).

New `templates/status.md` for `docs/engineering/STATUS.md`, rewritten (not appended) at every gate: phase diagram with status, gates table, current focus and next action, open questions count with top 3, open Critical/High, latest security audit and next due, environment health, links to the latest handover and team plan. ≤ 60 lines.

### 3.9 Questions & gaps (`docs/engineering/questions.md`)

Human-facing mirror of state.md Open questions and Assumptions to confirm, plus gaps found by any agent. Columns: ID, question or gap, why it matters, raised by (agent/phase), options with a recommendation, owner, status. **Gap review** at every gated approval: the lead walks the human through new and still-open items before asking for approval; answers become `# stated` profile fields, ADRs, plan tasks or accepted risks. In autonomous mode items become Assumptions and stay listed until a human confirms them.

### 3.10 Separation of powers (update)

The lead writes `docs/engineering/` (STATUS, team plan, questions, handovers, product, brief, plans, saved ADRs/specs) in addition to `.eng-team/*`. `eng-tech-writer` remains the only agent that writes reader docs (`docs/README.md`, `architecture.md`, `testing.md`, `runbook.md`, `compliance/`), and may format but never change decisions.

### 3.11 Files touched (Part A)

New: `shared/context.md`, `challenger/product-discovery.md`, `challenger/brainstorm.md`, `challenger/rationale-recovery.md`, `templates/product.md`, `templates/team-plan.md`, `templates/handover.md`, `templates/status.md`, `templates/questions.md`, `templates/context.md`, `templates/best-practices.md`.
Changed: `SKILL.md`, `shared/orchestration.md` (context step, migration, handover/STATUS at each gate, gap review), every `phases/*.md` (paths, Next up, handover), `roles/architect.md`, `roles/researcher.md`, `roles/tech-writer.md`, `templates/brief.md`/`adr.md` (recovered fields), commands that mention paths, README/CHANGELOG, validator (if it hardcodes paths), evals a, g and smoke test (new paths).

### 3.12 Verification (Part A)

- `scripts/validate.sh` and its self-tests; `claude plugin validate`.
- Re-run only the evals whose paths changed (a, g) plus k (onboarding now asks rationale questions and writes context), one run each on Sonnet.
- One new cheap eval: **l-context-reuse** — fixture with an existing CLAUDE.md and `.eng-team/context.md` at HEAD; the agent must say what it already knows, not re-scan unchanged code (no Read of unchanged `src/` files), and propose (not apply) a CLAUDE.md merge.
- No smoke re-run unless asked.

## 4. Part B — Visual workspace, index & MCP (separate spec after Part A)

Outline only; it gets its own design spec and plan.

- **Index** (`eng-team-plugin/viewer/`, Node, runs locally): parses `docs/**` and `.eng-team/*.md`; extracts explicit links (markdown links, `path:line`, ADR numbers, finding IDs, plan task IDs, handover references); chunks code by symbol/file; computes local embeddings with a small open model run in-process (e.g. transformers.js with a MiniLM/BGE-small class model, downloaded once after asking); stores in `.eng-team/.cache/index/` (gitignored). Incremental by file hash.
- **Web page** (`/eng-view` starts it on `localhost`): Notion-like navigation of docs with backlinks; a graph map (explicit links solid, semantic neighbours dashed with similarity); handover timeline; STATUS and team plan as the home page; markdown editing with save to disk (git shows the diff); code view-only with "open in editor" links; search across docs and code.
- **MCP server** (stdio, shipped in the plugin's `.mcp.json`): `search_context(query)`, `get_related(id|path)`, `changed_since(commit)`, `get_doc(path)`. Agents use it to fetch exactly the context they need, cutting repeated repo reads.
- Constraints: no network at runtime except the one-time approved model download; binds to `127.0.0.1` only; no write access to code; respects `.gitignore` and never indexes `.env` or secret-looking files.

## 5. Out of scope / rejected alternatives

- Hosted embeddings (sends code off-machine; rejected in D5).
- Browser editing of code (bypasses gates; rejected in D6).
- One living handover document (history hard to follow; rejected in D2).
- Asking "why" about every library choice (question fatigue; rejected in D4).
- Writing auto-memory content into the repo automatically (private context; only with explicit approval).
