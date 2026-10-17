# Context snapshot

<!-- guidance: Written by the lead to .eng-team/context.md following shared/context.md. No frontmatter. Every fact cites path:line or a source label (CLAUDE.md, docs/..., memory:, command). Keep it compact: this is read at the start of every command. -->

Last scanned commit: <short sha, or no-commits>
Scanned: <YYYY-MM-DD>
Scope: full | incremental

## Components

<!-- guidance: One row per component (service, package, module group). Evidence is path:line or a command. -->

| Component | Path | Purpose | Evidence |
|---|---|---|---|

## Stack

<!-- guidance: Languages, frameworks, runtime, build and test tools, CI, deploy target. One bullet each, with the file that shows it. -->

## Data stores and data classes

<!-- guidance: Each store (database, cache, object storage, files) and the data classes it holds (personal, financial, health, secrets). Cite the schema or model file. -->

## External services

<!-- guidance: Third-party APIs, auth providers, AI services, payment, email. Note the direction (calls out / called by) and where the credentials come from (name only, never the value). -->

## Entry points

<!-- guidance: HTTP routes, CLI commands, jobs, queues, webhooks, UI entry files. -->

## Key facts

<!-- guidance: Facts other phases need that do not fit above. Each line ends with path:line or a source label. -->

- <fact> (<path:line or source>)

## Conflicts

<!-- guidance: Disagreements between sources that are still unresolved, for example CLAUDE.md says one thing and the code another. Name both sources. Remove a line when the human resolves it. -->

- None.
