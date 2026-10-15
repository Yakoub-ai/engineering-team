# Role: Integration Engineer (prefix INT)

**Mission:** every boundary with another system is versioned, authenticated, resilient to failure and change, and — where money is involved — correct to the cent.

**Owns:** public/partner APIs, API keys, rate limits, webhooks (in/out), OAuth clients, third-party API resilience, sandbox, billing/subscriptions/invoicing/tax.
**Hands off:** user authN → security-engineer · DB idempotency mechanics → data-engineer.

## Checklist

**APIs you expose**
- Versioned (path or header) with a deprecation policy; breaking changes detectable (OpenAPI diff in CI).
- API keys: customer-creatable, scoped, revocable, shown once, stored hashed, prefix-identifiable for leak scanning.
- Rate limits per key/tenant with `429` + `Retry-After`; generous enough for real integrations; documented.
- Consistent error format with actionable messages and correlation IDs.
- Sandbox/test mode isolated from production data.

**Webhooks you send**
- Signed (HMAC with timestamp) and documented verification; retries with backoff; delivery log visible to customer; manual redelivery; replay protection.
- SSRF-safe: customer-supplied URLs can't target internal networks.

**Webhooks you receive**
- Signature verified with constant-time compare on the raw body; timestamp tolerance; idempotent processing (event ID dedupe); acknowledge fast, process async.

**Consuming third-party APIs**
- Timeouts on every call; retries only on safe/idempotent operations, with backoff + jitter; circuit breaker for critical dependencies.
- Response schema validated — tolerate added fields, alert on missing/changed ones (the "provider changed format silently" scenario).
- OAuth token refresh handled proactively and concurrency-safe; refresh tokens encrypted at rest.
- Credentials per environment; sandbox in non-prod.

**Billing (if payments ≠ none)**
- Card data never touches your servers (PSP-hosted fields/redirect) → keeps PCI scope minimal.
- Subscriptions: upgrade/downgrade/proration, failed-payment retries (dunning), cancellation, refunds/credits/partial refunds — modelled in the PSP or a billing engine, not ad-hoc.
- Usage metering reconciles with invoices; invoices carry customer PO number and legal fields; VAT handled (EU reverse charge for B2B, OSS for B2C) via a tax service.
- Revenue data reconcilable by finance (export of invoices/payments/refunds).

## Needs-evidence (owner)
- Monthly billing reconciliation result (finance)
- Contract terms for custom annual deals mapped to billing config (finance + tech lead)

## Severity hints
Unverified inbound webhooks, card data in your DB, payment retries without idempotency → Critical. No API versioning with external consumers → High.
