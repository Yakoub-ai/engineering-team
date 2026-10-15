---
id: api-design
kind: practice
status: reviewed
tier: plugin
sources:
  - title: Google API Improvement Proposals (AIP)
    url: https://google.aip.dev/general
    accessed: 2026-10-16
  - title: Microsoft REST API Guidelines
    url: https://github.com/microsoft/api-guidelines
    accessed: 2026-10-16
  - title: RFC 9457 Problem Details for HTTP APIs
    url: https://www.rfc-editor.org/rfc/rfc9457
    accessed: 2026-10-16
  - title: RFC 8594 The Sunset HTTP Header Field
    url: https://www.rfc-editor.org/rfc/rfc8594
    accessed: 2026-10-16
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.type == "api-platform" OR profile.type == "b2b-saas" OR profile.stacks contains "web"
---
# Practice pack: API design

Applies to any HTTP/REST API the system exposes or consumes. Look in OpenAPI files, route definitions, controllers, API gateway config, SDKs.

**Resource naming & versioning**
- Resources are nouns with consistent, hierarchical names; standard methods (get/list/create/update/delete) map to HTTP verbs, custom actions are the exception — [Google AIP-121/122/131-136](https://google.aip.dev/general)
- A version identifier exists from day one, and breaking changes ship only in a new version — [Google AIP-180/185](https://google.aip.dev/general), [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)
- Stability level (alpha/beta/stable) is stated per API or field so consumers know what may change — [Google AIP-181](https://google.aip.dev/general)

**Errors**
- Error bodies use `application/problem+json` with `type`, `title`, `status`, `detail`, `instance`; no stack traces or internals in `detail` — [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)
- One error shape across the whole API, with stable machine-readable codes — [Google AIP-193](https://google.aip.dev/general)

**Pagination, filtering, limits**
- Every list endpoint is paginated with a bounded default and maximum page size; no unbounded lists — [Google AIP-158](https://google.aip.dev/general), [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)
- Filtering and ordering are documented and validated server-side — [Google AIP-160](https://google.aip.dev/general)
- Throttled clients get a clear signal to back off (for example `Retry-After`) — [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)

**Idempotency**
- Create and other non-idempotent calls accept a client-supplied request ID or idempotency key so retries are safe — [Google AIP-155](https://google.aip.dev/general), [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)
- Retry guidance (which errors are retryable) is documented for clients — [Google AIP-194](https://google.aip.dev/general)

**Auth (needs-evidence where config is external)**
- Every endpoint has an explicit authN/authZ decision; scopes are least-privilege per operation, and object-level checks happen on every resource access — [Google AIP-211](https://google.aip.dev/general)
- Needs-evidence: token-based auth (OAuth 2.1 style, scoped tokens) is configured in the identity provider and declared in the API contract; the sources below do not specify flows — [Google AIP-211](https://google.aip.dev/general)

**Deprecation & sunset**
- Deprecated endpoints announce a `Sunset` header with the removal date and link to migration docs — [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594)
- Removal happens only after the announced sunset date and a compatibility window — [Google AIP-180](https://google.aip.dev/general)

**Contract**
- An OpenAPI (or equivalent) description is the source of truth; code, docs and SDKs are generated or checked against it in CI — [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)
- Breaking-change detection runs on the contract in CI — [Google AIP-180](https://google.aip.dev/general)

## Severity hints
Unauthenticated or missing object-level authZ on a data endpoint → High. Unbounded list endpoint on a growing table → Medium. Non-idempotent payment/create call with no idempotency key → Medium. Missing Sunset header on a deprecation → Low.
