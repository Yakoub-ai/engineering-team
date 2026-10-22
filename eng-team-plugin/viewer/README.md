# eng-team viewer

A local, read-mostly workspace for a project's engineering record (STATUS, team plan, product, specs, plans, decisions, handovers, questions, security reports) and its code, shown as one connected map. The same index is exposed to Claude agents through a stdio MCP server so they fetch only the context they need.

Requires Node 18 or newer. No required npm dependencies: it works offline right after install.

## Privacy and safety

- The server binds to `127.0.0.1` only and rejects any `Host` other than `127.0.0.1:<port>` or `localhost:<port>`.
- Writes need the header `X-Eng-View: 1` and are allowed only to `.md` files under `docs/` and `.eng-team/*.md` (never `.eng-team/state.md`). Code is view-only. Path traversal and symlinks are refused.
- Never indexed or served: `.git/`, `node_modules/`, `.eng-team/.cache/`, `dist/`, `build/`, binary files, files over 512 KB, `.env*`, `*.pem`, `*.key`, `id_rsa*`, and anything matched by the root `.gitignore`.
- Files whose content looks like a credential are excluded too, and re-checked on every read: PEM private keys, GCP service-account JSON, AWS, GitHub, Slack, Stripe, Google, Anthropic and OpenAI keys, and literal `password`/`secret`/`token` assignments (the last rule skips `.md` files). They are not indexed, searched, embedded or served by the page or `get_doc`. The log names the file and rule, never the value.
- The index lives at `<project>/.eng-team/.cache/index/index.json` (gitignore `.eng-team/.cache/`). Nothing is sent anywhere. Cache paths that are symlinks or leave the project are ignored.

## Commands

```
node bin/eng-view.js index  [--project <dir>] [--no-semantic]            build or update the index, print counts
node bin/eng-view.js serve  [--project <dir>] [--port <n>] [--no-semantic]   index, then serve (default port 4777); prints eng-view: http://127.0.0.1:<port>
node bin/eng-view.js build  [--project <dir>] [--only <cheatsheet,brief,summary,deck>] [--force]   write docs/present/*.html (deterministic, no network); prints gap lines
node bin/eng-view.js mcp    [--project <dir>] [--no-semantic]            stdio MCP server
```

Project directory: `--project`, else `CLAUDE_PROJECT_DIR`, else the current directory. In Claude Code use `/eng-view`.

## HTTP API

| Route | Result |
|---|---|
| `GET /`, `GET /ui/*` | the single-page UI |
| `GET /api/graph` | `{nodes, edges}` |
| `GET /api/node?id=` | node plus outgoing and incoming edges |
| `GET /api/doc?path=` | `{path, markdown, html, editable}` |
| `PUT /api/doc?path=` | body `{markdown}`; writes an editable doc and re-indexes it (403 otherwise) |
| `GET /api/code?path=` | `{path, text, language}`, read-only |
| `GET /api/search?q=&limit=` | ranked nodes |
| `GET /api/timeline` | handovers in order |

## MCP tools

The plugin's `.mcp.json` registers the server as `eng-team-context` (protocol `2025-06-18`, JSON-RPC over stdin/stdout, newline-delimited; logs go to stderr). The index is built or refreshed incrementally on the first tool call.

- `search_context {query, limit=8, kinds?}` ranked items with path, line, title, snippet and score.
- `get_related {id_or_path, limit=10}` explicit links first, then semantic or lexical neighbours.
- `changed_since {commit}` `git diff --name-status <commit>..HEAD` mapped to index nodes.
- `get_doc {path}` text of an indexed file (code capped at 2000 lines); excluded files are refused.

Tool failures are returned as results with `isError: true`; unknown methods return JSON-RPC error `-32601`.

## Optional semantic layer

Without it, "related" links use TF-IDF cosine similarity (edges labelled `lexical`). To use local embeddings (edges labelled `semantic`):

```
npm install --prefix ${CLAUDE_PLUGIN_DATA}/viewer-deps --no-save --no-fund --no-audit --ignore-scripts @huggingface/transformers@3.8.1
```

`/eng-view` shows this command and asks once before running it. It installs into the plugin's data folder (`ENG_VIEW_DEPS_DIR` overrides the location), so plugin updates do not remove it.

The model `Xenova/all-MiniLM-L6-v2` (about 25 MB) is downloaded once into `<project>/.eng-team/.cache/models/`. Pass `--no-semantic` to skip it. If the package or model is unavailable, the viewer falls back to lexical (logged to stderr).

## Tests

```
cd viewer && node --test test/*.test.js
```
