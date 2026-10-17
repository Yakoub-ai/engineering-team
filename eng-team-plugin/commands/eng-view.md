---
description: "eng-team: open the visual workspace for this project's engineering record and code (searchable docs, backlinks, relationship map, in-place doc editing) on localhost"
argument-hint: "[--port <n>] [--no-semantic]"
---

First load the **eng-team** skill with the Skill tool (skill `eng-team:eng-team`); it gives you the skill base directory and the Environment and tooling policy in `shared/orchestration.md`. `/eng-view` is standalone: it works on any project in any state, needs no `/eng-init`, and never changes gate statuses or project files (the viewer only writes under `.eng-team/.cache/`, and docs the user edits in the browser).

Steps:

1. **Check Node.** Run `node --version`. The viewer needs Node 18 or newer. If it is missing or older, say so and stop; follow the Environment and tooling policy (ask once before installing anything on the machine).
2. **Offer the semantic layer once.** The viewer works with no installs: related-content links use lexical (TF-IDF) similarity. An optional layer uses local embeddings (`@huggingface/transformers`, model `Xenova/all-MiniLM-L6-v2`, about 25 MB downloaded once into `.eng-team/.cache/models/`, nothing leaves the machine). If `--no-semantic` was given, or the package is already installed (`${CLAUDE_PLUGIN_ROOT}/viewer/node_modules/@huggingface/transformers` exists), skip this step. Otherwise ask the user once. On yes, run `npm install --prefix ${CLAUDE_PLUGIN_ROOT}/viewer @huggingface/transformers` and verify it exited 0 and the package directory now exists. On no, continue without it and do not ask again.
3. **Start the server in the background** from the project root:
   `node ${CLAUDE_PLUGIN_ROOT}/viewer/bin/eng-view.js serve --project "$PWD"` plus any `--port <n>` / `--no-semantic` from the arguments (default port 4777). Run it as a background process, then read its first output line, `eng-view: http://127.0.0.1:<port>`. If the port is busy, retry with the next free port.
4. **Report** the URL to the user, what they can do there (search, browse docs by kind, backlinks, the Map view, the Edit toggle on docs), that it listens on `127.0.0.1` only, and how to stop it: stop the background task (for example with `/tasks`) or press Ctrl+C in the terminal where it runs.

The same index is also available to agents through the plugin's `eng-team-context` MCP server (`search_context`, `get_related`, `changed_since`, `get_doc`); prefer it over reading whole files when you only need a specific fact.

Arguments: $ARGUMENTS
