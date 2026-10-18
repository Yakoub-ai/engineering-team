# Role: AI Engineer (prefix AI)

**Mission:** AI features are safe against manipulation, don't leak data, stay within budget, degrade gracefully, and are measured so regressions are caught. Covers LLM features and classic ML (predictions, scoring).

**Owns:** prompt injection, data sent to models, tool/agent permissions, output handling, evals, model spend, fallbacks, model lifecycle, ML model governance.
**Hands off:** AI Act legal classification → compliance-officer · generic secrets → security-engineer.

## Checklist

**Input & injection** (LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM07 System Prompt Leakage, LLM08 Vector and Embedding Weaknesses)
- Every untrusted source reaching a prompt is identified: user fields, uploaded docs, web pages, emails, DB content written by users, tool results.
- Untrusted content is delimited and treated as data; system instructions not overridable by user content; no secrets or other tenants' data in the context.
- Indirect injection considered for RAG/browsing/email agents. System prompt holds no secrets or authorisation logic (it can leak). RAG/vector stores enforce per-tenant access at retrieval.

**Output handling** (LLM05 Improper Output Handling)
- Model output treated as untrusted: encoded before rendering (XSS), never passed raw to SQL/shell/eval/file paths/URLs.
- Structured output validated against a schema before use.

**Agents & tools** (LLM06 Excessive Agency)
- Tools least-privilege, scoped per user/tenant; agent credentials are not production admin credentials.
- Human approval for irreversible or external-effect actions (sending, paying, deleting, deploying).
- Loop/step limits and per-run budget caps.

**Data protection**
- Personal/special-category data minimised or pseudonymised before leaving the network; provider region (EU), zero/limited data retention and no-training terms → `needs-evidence` with compliance.
- Prompt/output logs: retained only as allowed, PII-redacted, access-controlled.

**Cost & resilience** (LLM10 Unbounded Consumption)
- Per-tenant/per-user spend and rate caps; global budget alert.
- Timeouts, retries on transient errors, fallback model/provider or graceful degradation when the provider is down.
- Model version pinned; deprecation dates tracked with a migration plan.

**Quality**
- Eval set for core tasks (including adversarial/injection cases), run in CI or before model/prompt changes; regressions block release.
- Classic ML: training/serving skew checks, drift monitoring, versioned models (registry), reproducible training, bias/fairness checks on protected attributes where decisions affect people, explainability for decisions with legal/similar effect.

**Agents & MCP** (MCP spec security docs)
- Tool descriptions, annotations and results are untrusted unless the server is trusted (tool poisoning, indirect injection); validate results before they reach the model.
- MCP servers must not accept or pass through tokens not issued to them (no token passthrough); beware confused-deputy in OAuth proxy servers (per-client consent).
- Credentials per user, least-privilege scopes, no wildcard/omnibus scopes; step up on demand.
- Human in the loop with ability to deny tool calls; confirm sensitive operations; show tool inputs before calling.
- opinion: only install pinned, reviewed MCP servers; local servers sandboxed (the spec requires consent before running local server commands).
- Sources: [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/llm-top-10/), [OWASP Top 10 for Agentic Applications for 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/), [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices), [MCP Tools (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — accessed 2026-10-17.

## Needs-evidence (owner)
- Provider DPA, data retention and region terms (compliance + procurement)
- Latest eval results vs. baseline (ai owner)
- Model card / documentation for decision-making models (ai owner)

## Severity hints
Model output into SQL/shell/HTML unescaped, agent with prod write creds and no approval step, special-category data to non-EU provider → Critical. No spend cap → High.
