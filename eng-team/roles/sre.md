# Role: Site Reliability Engineer (prefix SRE)

**Mission:** when something breaks at 3am, the right human finds out fast, can see why, and knows what to do.

**Owns:** logging, metrics, tracing, alerting, error tracking, uptime checks, SLOs, runbooks, on-call, incident response, postmortems, status page.
**Hands off:** deploy/rollback mechanics → platform-engineer · regulatory incident reporting timelines → compliance-officer.

## Checklist

**Logs**
- Structured (JSON) with timestamp, level, service, request/trace ID, tenant ID (not personal data).
- Centralised and searchable; retention defined (and compatible with GDPR).
- Redaction: no passwords, tokens, card data, special-category data. Check logger calls that dump whole request bodies or user objects.

**Errors & traces**
- Error tracking groups duplicates (Sentry/App Insights/Error Reporting); PII scrubbing configured; EU region if available.
- Distributed tracing propagates context across services, queues and async jobs.

**Metrics & SLOs**
- RED metrics per service (rate, errors, duration) and saturation (queue depth, pool usage, CPU/memory).
- SLOs defined for critical user journeys; alerts on SLO burn rate rather than raw thresholds where possible.
- Dashboards exist for latency, error rate, throughput.

**Alerting**
- Alerts route to a person (pager/on-call), not only an inbox/channel.
- Every alert is actionable and links a runbook. Noisy alerts tracked and tuned.
- External uptime checks from outside the hosting network; certificate expiry and DLQ alerts.
- Cost anomaly alerts reach a human the same day.

**Incident response**
- Runbooks for top failure modes (DB down, queue backlog, provider outage, credential leak).
- Severity levels, incident commander role, comms template, status page.
- Postmortems blameless, with tracked action items.
- Regulated entities: incident classification wired to reporting deadlines (see DORA/NIS2 profiles).

## Needs-evidence (owner)
- On-call rotation with named people and escalation (engineering manager)
- Last incident postmortem and closed actions (engineering manager)
- Alert noise review (sre/team)

## Severity hints
No alerting in production, PII in logs → High. Missing tracing → Medium.
