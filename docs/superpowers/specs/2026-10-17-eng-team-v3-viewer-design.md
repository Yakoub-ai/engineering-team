# eng-team v3 Part B — Visual workspace, index & MCP — Design Spec

Date: 2026-10-17 · Parent: `2026-10-17-eng-team-v3-context-transparency-design.md` (decisions D5-D7 binding; section 4 outline expanded here).

## 1. Goal

A local, Notion-like page that shows a project's engineering record (STATUS, team plan, product, specs, plans, decisions, handovers, questions, security reports) and its code as one connected map, lets the human edit the docs in place, and exposes the same index to Claude agents through a local MCP server so they fetch only the context they need.

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| B1 | Node ≥ 18, **zero required npm dependencies** for indexer, server, UI and MCP | The plugin's MCP server starts in every session; a missing `npm install` must never break it. Works offline. |
| B2 | Semantic layer is **optional**: `@huggingface/transformers` loaded by dynamic import if installed; model `Xenova/all-MiniLM-L6-v2` (384-dim), cached under `.eng-team/.cache/models/` | Local embeddings (D5) without forcing a ~25 MB download; install is asked once per the plugin's Environment and tooling policy. |
| B3 | Fallback when the semantic layer is absent: TF-IDF cosine similarity; edges labelled `lexical` instead of `semantic` | The map still shows "related but unlinked" content. |
| B4 | Markdown rendered by a small built-in renderer (headings, paragraphs, lists, tables, code fences, links, emphasis, blockquotes, Mermaid blocks shown as code) | No vendored third-party code to audit; enough for the engineering docs. |
| B5 | Graph drawn on `<canvas>` with a small built-in force layout | No dependency; handles a few thousand nodes. |
| B6 | Server binds to `127.0.0.1` only; default port 4777 (`--port`); writes allowed only to `.md` files under `docs/` and to `.eng-team/*.md` excluding `state.md`; path traversal rejected | D6: docs editable, code view-only; state.md is machine state owned by the lead. |
| B7 | Index stored at `<project>/.eng-team/.cache/index/index.json` (gitignored with `.eng-team/.cache/`), incremental by file mtime + size + sha1 | Fast re-index; nothing committed. |
| B8 | Never index: `.git/`, `node_modules/`, `.eng-team/.cache/`, `dist/`, `build/`, binary files, files > 512 KB, `.env*`, `*.pem`, `*.key`, `id_rsa*`, anything matched by root `.gitignore` (simple glob subset) | Secrets and noise stay out. |
| B9 | MCP over stdio, JSON-RPC 2.0, protocol version `2025-06-18`, implemented directly (no SDK) | B1. |

## 3. Components (`eng-team-plugin/viewer/`)

```
viewer/
  package.json            name eng-team-viewer, private, type module, engines node>=18, optionalDependencies @huggingface/transformers, scripts.test "node --test test/"
  bin/eng-view.js         CLI: index | serve | mcp  [--project <dir>] [--port <n>] [--no-semantic]
  lib/scan.js             walk project, apply B8 exclusions, classify files (doc | code | state)
  lib/links.js            extract explicit links from markdown and code
  lib/index.js            build/load/save index, incremental update, search
  lib/similarity.js       TF-IDF vectors + cosine; optional embedder interface
  lib/embed.js            optional transformers.js embedder (dynamic import, returns null when unavailable)
  lib/server.js           http server + JSON API + static UI
  lib/mcp.js              stdio MCP server
  lib/markdown.js         minimal markdown → HTML (server-side, escaped)
  ui/index.html · ui/app.js · ui/style.css     single-page UI, no build step
  test/                   node:test suites + test/fixtures/project/
  README.md
```

### 3.1 Index model

`index.json`: `{ version: 1, project, builtAt, commit, nodes: [...], edges: [...], files: {path: {mtime,size,sha1}}, vocab?, semantic: "embeddings"|"lexical" }`.

Node: `{ id, kind, path, title, line?, summary, tokens? }`. Kinds: `doc` (any markdown), `handover`, `decision` (ADR), `spec`, `plan`, `plan-task` (`T<n>`, `F<n>`, `R-<nn>` headings/rows inside plans), `finding` (`SEC-001`-style IDs defined in reports, prefixes from the plugin: SEC CMP DAT PLT SRE QA INT AI PRD LEAD RES ARC BLD TST DOC), `question` (`Q-<n>`), `use-case` (`UC-<n>`), `code` (one per code file), `status`, `team-plan`. `id` is stable: `path` for files, `path#ID` for in-file items.

Edges: `{ from, to, type, score? }`. Types: `link` (markdown link to a file in the project), `ref` (`path:line` or backticked repo path mention → code or doc node), `id` (mention of an ADR number `ADR-0003`/`0003-…`, finding ID, question ID, UC ID, plan task ID defined elsewhere), `contains` (file → its in-file items), `imports` (JS/TS `import`/`require`, Python `import`/`from`, relative paths only), `semantic`/`lexical` (top-5 neighbours with score ≥ 0.35 lexical or ≥ 0.6 semantic, docs↔docs and docs↔code).

### 3.2 HTTP API (`lib/server.js`)

- `GET /` → UI. `GET /ui/*` static.
- `GET /api/graph` → `{nodes, edges}` (no tokens).
- `GET /api/node?id=` → node + outgoing/incoming edges (backlinks).
- `GET /api/doc?path=` → `{path, markdown, html, editable}`; `PUT /api/doc?path=` body `{markdown}` → writes if editable (B6), then re-indexes that file; 403 otherwise.
- `GET /api/code?path=` → `{path, text, language}` read-only (B8 exclusions → 404).
- `GET /api/search?q=&limit=` → ranked nodes (TF-IDF or embeddings).
- `GET /api/timeline` → handovers sorted by number/date.
- All responses JSON with `Cache-Control: no-store`; reject requests whose `Host` is not `127.0.0.1:<port>` or `localhost:<port>` (DNS-rebinding guard); writes require header `X-Eng-View: 1` (CSRF guard for a localhost app).

### 3.3 UI (`ui/`)

Left sidebar: search box; tree grouped as Overview (STATUS, team plan, questions), Product, Specs, Plans, Decisions, Handovers (timeline order), Security & reviews, Other docs, Code. Main pane: rendered doc with an **Edit** toggle (textarea, Save → PUT, Cancel) for editable docs; code pane read-only with line numbers and an `open in editor` link (`vscode://file/<abs>:<line>`). Right pane: backlinks and related (semantic/lexical with score). **Map** view: canvas force graph, colour by kind, solid lines for explicit edges, dashed for semantic/lexical, click a node to open it, filter by kind, search highlights. Home = `docs/engineering/STATUS.md` when present, else README. Light/dark via `prefers-color-scheme`. Keyboard: `/` focuses search, `e` toggles edit, `g` opens map.

### 3.4 MCP server (`lib/mcp.js`, plugin `.mcp.json`)

Plugin root gets `.mcp.json`:
```json
{ "mcpServers": { "eng-team-context": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/viewer/bin/eng-view.js", "mcp"] } } }
```
Project dir: `--project`, else `CLAUDE_PROJECT_DIR`, else cwd. Builds or loads the index lazily on first tool call (incremental). Tools:
- `search_context {query, limit=8, kinds?}` → ranked items with path, line, title, snippet (≤ 300 chars), score.
- `get_related {id_or_path, limit=10}` → explicit edges first, then semantic/lexical.
- `changed_since {commit}` → `git diff --name-status <commit>..HEAD` mapped to nodes (or an error text if git or commit unavailable).
- `get_doc {path}` → markdown text of a doc (B8 exclusions apply; code files return the text with a 2 000-line cap).
Handles `initialize`, `notifications/initialized`, `tools/list`, `tools/call`, `ping`; unknown methods → JSON-RPC error -32601. Never writes to stdout except protocol messages; logs to stderr.

### 3.5 CLI and command

`node viewer/bin/eng-view.js index` (build/update, print counts), `serve` (index then serve, print URL), `mcp`. New `commands/eng-view.md`: loads the eng-team skill, checks Node ≥ 18, offers once to install the optional semantic layer (`npm install --prefix <plugin>/viewer @huggingface/transformers`) per Environment and tooling, starts `serve` in the background and gives the URL; says how to stop it.

## 4. Verification

- `cd eng-team-plugin/viewer && node --test test/` green, output pristine.
- Fixture project under `viewer/test/fixtures/project/` with docs/engineering (STATUS, a handover, an ADR, a plan with T1/T2, questions with Q-1), docs/security report with SEC-001, `src/a.js` importing `src/b.js`, a `.env` that must never be indexed.
- Server tests: traversal (`../`), write to code → 403, write to state.md → 403, bad Host → 403, missing `X-Eng-View` → 403, PUT doc happy path re-indexes.
- MCP test: spawn `bin/eng-view.js mcp --project <fixture>`, send initialize / tools/list / tools/call search_context, assert JSON-RPC shapes.
- Manual: `node bin/eng-view.js serve --project ../tests/fixtures/i-legacy-app` and load `/api/graph`.
- `bash eng-team-plugin/scripts/validate.sh eng-team-plugin` and `claude plugin validate eng-team-plugin` still pass with `.mcp.json` added.

## 5. Out of scope

Hosted embeddings; code editing in the browser; multi-user/remote access; real-time file watching (re-index on request and on save only); rendering Mermaid diagrams graphically (shown as code blocks, may be added later).
