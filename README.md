# engineering-team

Home of **eng-team**: a full-lifecycle engineering team (research → challenge → architect → build → test → document → review) plus tool-backed security audits, environment setup, context reuse, recorded handovers and a local visual workspace for any project. It is EU-regulation aware (GDPR, DORA, NIS2, AI Act, accessibility) and extends to other jurisdictions and frameworks. It ships as a Claude Code plugin and as a claude.ai skill.

**Start here → [eng-team-plugin/README.md](eng-team-plugin/README.md)**

```
/plugin marketplace add Yakoub-ai/engineering-team
/plugin install eng-team@yakoub-ai
```

Then type `/eng-team:eng-start` for a 5-minute tour and an environment check (Node 18+ is needed for the viewer and security hooks).

| Path | What |
|---|---|
| `eng-team-plugin/` | The plugin: agents, commands, skill, local viewer + MCP context server (`viewer/`), validator, evals, smoke test |
| `.claude-plugin/marketplace.json` | Marketplace entry (`eng-team@yakoub-ai`) |
