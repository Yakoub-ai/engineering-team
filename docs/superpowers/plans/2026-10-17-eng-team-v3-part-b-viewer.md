# eng-team v3 Part B (viewer, index, MCP) — Implementation Plan

Spec: `docs/superpowers/specs/2026-10-17-eng-team-v3-viewer-design.md` (binding; decisions B1-B9 are not to be re-litigated).

## Context

New code lives in `eng-team-plugin/viewer/` (Node ≥ 18, ES modules, zero required dependencies). The rest of the plugin is markdown and is being changed in parallel by another branch — do not edit anything outside `eng-team-plugin/viewer/`, `eng-team-plugin/.mcp.json` and `eng-team-plugin/commands/eng-view.md`.

## Global Constraints

- Node built-ins only (`node:fs`, `node:path`, `node:http`, `node:crypto`, `node:child_process`, `node:test`, `node:assert`, `node:readline`). The only allowed package is the optional `@huggingface/transformers`, loaded via dynamic `import()` inside `lib/embed.js` and never required for tests to pass.
- ES modules (`"type": "module"`), 2-space indent, small focused functions, JSDoc on exported functions.
- Tests with `node:test` in `viewer/test/*.test.js`; `cd eng-team-plugin/viewer && node --test test/` must pass with pristine output (no stray console output).
- Exclusions (B8), write rules (B6), index location (B7), edge types and thresholds (spec 3.1), API routes and guards (spec 3.2), MCP tools and protocol version `2025-06-18` (spec 3.4) are exact.
- Commit messages: imperative subject, short body. NEVER add `Co-Authored-By` or any "Generated with Claude" attribution line.
- TDD: write the failing test first for each module, then implement.

### Task 1: Scaffold, scanner, link extraction, index build

Create `viewer/package.json` (spec 3), `viewer/lib/scan.js`, `viewer/lib/links.js`, `viewer/lib/index.js` (build, save, load, incremental update by mtime+size+sha1, `search(query, {limit, kinds})` using TF-IDF from `lib/similarity.js`), `viewer/lib/similarity.js` (tokenize, TF-IDF, cosine, top-k neighbours with threshold 0.35 → `lexical` edges), and the test fixture `viewer/test/fixtures/project/` described in spec section 4 (include `.env` containing `SECRET=do-not-index`, a `node_modules/x/index.js`, and a root `.gitignore` with `ignored/` plus `ignored/file.md`).

Node kinds, ids and edge types per spec 3.1 (`link`, `ref`, `id`, `contains`, `imports`, `lexical`). Classification: `docs/engineering/handovers/*.md` → handover, `docs/engineering/decisions/*.md` → decision, `docs/engineering/specs/*.md` → spec, `docs/engineering/plans/*.md` → plan, `docs/engineering/STATUS.md` → status, `docs/engineering/team-plan.md` → team-plan, other `.md` → doc, code by extension (js, mjs, cjs, ts, tsx, jsx, py, go, rb, java, kt, cs, php, rs, sh, sql, tf, yaml, yml, toml, json, Dockerfile) → code; `.eng-team/state.md` → state.

Tests: exclusions (no `.env`, no node_modules, no ignored/), kinds, `contains` edges for T1/T2 in the plan and SEC-001 in the report, `id` edge from the handover mentioning `ADR-0001`/`SEC-001`, `ref` edge from a doc mentioning `src/a.js:3`, `imports` edge a.js → b.js, incremental update re-reads only a changed file, search returns the expected doc first for a distinctive word, index saved at `.eng-team/.cache/index/index.json` inside the fixture copy (tests copy the fixture to a temp dir first; never write into the fixture).

### Task 2: Optional semantic layer

Create `viewer/lib/embed.js`: `async function createEmbedder({cacheDir})` → returns `{ embed(texts): Promise<Float32Array[]>, model: 'Xenova/all-MiniLM-L6-v2' }` using `@huggingface/transformers` `pipeline('feature-extraction', model, {cache_dir})` with mean pooling + normalize, or `null` when the package is not installed or loading fails (no throw, no stdout). Extend `lib/index.js` build to accept an injected embedder: with one, compute `semantic` edges (top-5, cosine ≥ 0.6) and set `semantic: "embeddings"`; without, `lexical` edges and `semantic: "lexical"`. `search` uses embeddings when the index has them and an embedder is available, else TF-IDF.

Tests: inject a fake deterministic embedder (e.g. bag-of-letters vector) to assert semantic edges/labels; `createEmbedder` returns null in the test environment when the package is absent (skip that assertion if it is actually installed).

### Task 3: Markdown renderer and HTTP server

Create `viewer/lib/markdown.js` (spec B4; HTML-escape all text; links rendered as `<a>` with `data-path` for in-project targets; no raw HTML passthrough) and `viewer/lib/server.js` implementing spec 3.2 exactly (routes, editability B6, Host check, `X-Eng-View: 1` on writes, `Cache-Control: no-store`, re-index of a saved file). Export `createServer({projectDir, port, embedder})` returning the `http.Server` (not listening) plus a `start()` helper.

Tests (`test/markdown.test.js`, `test/server.test.js`, server on an ephemeral port bound to 127.0.0.1): renderer escapes `<script>`; tables and code fences; `GET /api/graph` shape; `GET /api/doc` editable true for a docs file and false for `.eng-team/state.md`; PUT happy path writes and the search finds the new word; PUT to `src/a.js`, to `.eng-team/state.md`, to `../outside.md` → 403; wrong Host → 403; PUT without header → 403; `GET /api/code?path=.env` → 404.

### Task 4: UI

Create `viewer/ui/index.html`, `viewer/ui/app.js`, `viewer/ui/style.css` implementing spec 3.3 (sidebar groups, doc view with Edit/Save/Cancel using `X-Eng-View: 1`, code view with line numbers and `vscode://file/<abs>:<line>` link, backlinks and related panel with scores, Map view with canvas force layout — solid explicit edges, dashed semantic/lexical, colour by kind, kind filter, click to open, search highlight — handover timeline, home = STATUS.md else README, light/dark via `prefers-color-scheme`, keyboard `/`, `e`, `g`). Plain browser JS, no external requests, no frameworks. The server must already serve `/ui/*` from Task 3; the API returns absolute project path in `GET /api/graph` as `project` for the vscode link.

Tests: `test/ui.test.js` — server serves `/` and `/ui/app.js` with correct content types; `app.js` contains no `http://` or `https://` URLs other than the `vscode://` scheme and SVG namespace (no external requests). Manual check documented in the report: start `node bin/eng-view.js serve --project test/fixtures/project --port 4799` (after Task 5 exists, or a temporary script) — if `bin` does not exist yet, test via `createServer` in a scratch script outside the repo.

### Task 5: MCP server, CLI, .mcp.json, command, README

Create `viewer/lib/mcp.js` (spec 3.4 exactly: stdio JSON-RPC 2.0, newline-delimited messages, protocol version `2025-06-18`, tools `search_context`, `get_related`, `changed_since`, `get_doc` with JSON Schemas, lazy incremental index, project dir resolution `--project` → `CLAUDE_PROJECT_DIR` → cwd, errors as JSON-RPC errors or tool results with `isError: true`, stderr-only logging), `viewer/bin/eng-view.js` (CLI `index | serve | mcp`, flags `--project`, `--port` (default 4777), `--no-semantic`; `serve` prints `eng-view: http://127.0.0.1:<port>`), `eng-team-plugin/.mcp.json` (exact content in spec 3.4), `eng-team-plugin/commands/eng-view.md` (frontmatter `description` and `argument-hint: "[--port <n>] [--no-semantic]"`; body per spec 3.5, starting with "First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`)" like the other commands; asks once before installing the optional semantic layer; runs `serve` in the background; tells the user the URL and how to stop it), and `viewer/README.md` (what it is, privacy guarantees, commands, API, MCP tools, optional semantic layer).

Tests (`test/mcp.test.js`): spawn `node bin/eng-view.js mcp --project <temp copy of fixture>`, send `initialize` (assert `protocolVersion` and `serverInfo.name` = `eng-team-context`), `notifications/initialized`, `tools/list` (4 tools), `tools/call search_context` (result content text contains a fixture doc path), `tools/call get_doc` on `.env` → `isError: true`, unknown method → error code -32601. `test/cli.test.js`: `index` prints counts and creates the index file.

Final check: `bash eng-team-plugin/scripts/validate.sh eng-team-plugin` passes and `claude plugin validate eng-team-plugin` passes (run from the worktree root).
