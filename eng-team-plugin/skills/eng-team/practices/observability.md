---
id: observability
kind: practice
status: reviewed
tier: plugin
sources:
  - title: OpenTelemetry documentation
    url: https://opentelemetry.io/docs/
    accessed: 2026-10-16
  - title: "Google SRE book: Monitoring Distributed Systems"
    url: https://sre.google/sre-book/monitoring-distributed-systems/
    accessed: 2026-10-16
  - title: "Google SRE book: Service Level Objectives"
    url: https://sre.google/sre-book/service-level-objectives/
    accessed: 2026-10-16
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.stage != "prototype"
---
# Practice pack: observability

Applies once the system serves real users. Look in logging config, metrics/tracing setup, OpenTelemetry Collector config, alert rules, dashboards.

**Logs**
- Logs are structured (key-value/JSON) and carry trace and request IDs so a request can be followed across services — [OpenTelemetry docs](https://opentelemetry.io/docs/)
- Logs include enough context to debug without reproducing, and are free of secrets — [OpenTelemetry docs](https://opentelemetry.io/docs/)

**Metrics**
- Services expose the four golden signals: latency, traffic, errors, saturation (RED for request-driven services, USE for resources) — [Google SRE book: Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
- Latency is measured as distributions/percentiles, not only averages — [Google SRE book: SLOs](https://sre.google/sre-book/service-level-objectives/)

**Traces**
- Distributed tracing uses OpenTelemetry instrumentation with context propagation across service calls — [OpenTelemetry docs](https://opentelemetry.io/docs/)
- Semantic conventions are used for attribute names; metric label cardinality is bounded — [OpenTelemetry docs](https://opentelemetry.io/docs/)

**SLIs, SLOs, error budgets**
- User-facing SLIs are chosen (availability, latency) with a target SLO per service — [Google SRE book: SLOs](https://sre.google/sre-book/service-level-objectives/)
- The SLO defines an error budget that drives release and reliability decisions — [Google SRE book: SLOs](https://sre.google/sre-book/service-level-objectives/)

**Alerting**
- Alert on symptoms (user-visible impact) rather than causes; pages are actionable and urgent — [Google SRE book: Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
- Alert rules are simple to understand and represent a clear failure; remove noisy ones — [Google SRE book: Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)

**PII in telemetry**
- Personal and sensitive data is kept out of logs, spans and metric labels, or redacted before export (Collector processors) — [OpenTelemetry docs](https://opentelemetry.io/docs/)
- Telemetry backend region and retention match the data-residency and retention policy (needs-evidence) — [OpenTelemetry docs](https://opentelemetry.io/docs/)

## Severity hints
PII or secrets in logs/traces → High. Production service with no error or latency alerting → High. No correlation IDs across services → Medium. Cause-based noisy alerts, no SLO defined → Low.
