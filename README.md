# engineering-team

Home of **eng-team**: a full-lifecycle engineering team (research → challenge → architect → build → test → document → review) plus tool-backed security audits (static and DAST, with remediation plans) for any project. It is EU-regulation aware (GDPR, DORA, NIS2, AI Act, accessibility) and extends to other jurisdictions and frameworks. It ships as a Claude Code plugin and as a claude.ai skill.

**Start here → [eng-team-plugin/README.md](eng-team-plugin/README.md)**

```
/plugin marketplace add Yakoub-ai/engineering-team
/plugin install eng-team@yakoub-ai
```

| Path | What |
|---|---|
| `eng-team-plugin/` | The plugin: agents, commands, skill, validator, evals, smoke test |
| `.claude-plugin/marketplace.json` | Marketplace entry (`eng-team@yakoub-ai`) |
| `docs/superpowers/` | Design spec and implementation plan |
