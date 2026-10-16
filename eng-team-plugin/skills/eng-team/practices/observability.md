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
  - title: The USE Method (Brendan Gregg)
    url: https://www.brendangregg.com/usemethod.html
    accessed: 2026-10-16
  - title: The RED Method (Grafana Labs)
    url: https://grafana.com/blog/the-red-method-how-to-instrument-your-services/
    accessed: 2026-10-16
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.stage != "prototype"
---
# Practice pack: observability

Applies once the system serves real users. Look in logging config, metrics/tracing setup, OpenTelemetry Collector config, alert rules, dashboards.

**Logs**
- Logs are structured and carry trace context (trace and span IDs) so they correlate with traces — [OpenTelemetry: Logs](https://opentelemetry.io/docs/concepts/signals/logs/)
- opinion: a request/correlation ID is logged by every service so one request can be followed across services.

**Metrics**
- Request-driven services expose Rate, Errors, Duration (RED) — [Grafana: RED method](https://grafana.com/blog/the-red-method-how-to-instrument-your-services/)
- Resources are checked for Utilization, Saturation, Errors (USE) — [Brendan Gregg: USE method](https://www.brendangregg.com/usemethod.html)
- Dashboards include the four golden signals: latency, traffic, errors, saturation — [Google SRE book: Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
- Latency is judged by distribution/percentiles, not only averages — [Google SRE book: SLOs](https://sre.google/sre-book/service-level-objectives/)

**Traces**
- Distributed tracing propagates context across service calls — [OpenTelemetry: Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/)
- Spans use shared attribute names from semantic conventions — [OpenTelemetry: Semantic conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
- opinion: keep metric label cardinality bounded (no user IDs or URLs with IDs as labels).

**SLIs, SLOs, error budgets**
- User-facing SLIs (availability, latency) are chosen with a target SLO per service — [Google SRE book: SLOs](https://sre.google/sre-book/service-level-objectives/)
- The SLO defines an error budget used for release and reliability decisions — [Google SRE book: SLOs](https://sre.google/sre-book/service-level-objectives/)

**Alerting**
- Alert on symptoms (what is broken for users) rather than causes — [Google SRE book: Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
- Alert rules for humans are simple and represent a clear failure; noisy rules are removed — [Google SRE book: Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)

**PII in telemetry**
- Sensitive and personal data is kept out of telemetry or redacted before export — [OpenTelemetry: Handling sensitive data](https://opentelemetry.io/docs/security/handling-sensitive-data/)
- opinion: telemetry backend region and retention match the data-residency and retention policy (needs-evidence).

## Severity hints
PII or secrets in logs/traces → High. Production service with no error or latency alerting → High. No correlation IDs across services → Medium. Cause-based noisy alerts, no SLO defined → Low.
