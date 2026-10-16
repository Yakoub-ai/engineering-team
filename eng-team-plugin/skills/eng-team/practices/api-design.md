---
id: api-design
kind: practice
status: reviewed
tier: plugin
sources:
  - title: Google API Improvement Proposals (AIP)
    url: https://google.aip.dev/general
    accessed: 2026-10-16
  - title: Microsoft Azure REST API Guidelines
    url: https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md
    accessed: 2026-10-16
  - title: RFC 9457 Problem Details for HTTP APIs
    url: https://www.rfc-editor.org/rfc/rfc9457
    accessed: 2026-10-16
  - title: RFC 8594 The Sunset HTTP Header Field
    url: https://www.rfc-editor.org/rfc/rfc8594
    accessed: 2026-10-16
  - title: OWASP API Security Top 10 2023, API1 Broken Object Level Authorization
    url: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
    accessed: 2026-10-16
  - title: The OAuth 2.1 Authorization Framework (IETF draft)
    url: https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/
    accessed: 2026-10-16
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.type == "api-platform" OR profile.type == "b2b-saas" OR profile.stacks contains "web"
---
# Practice pack: API design

Applies to any HTTP/REST API the system exposes or consumes. Look in OpenAPI files, route definitions, controllers, API gateway config, SDKs.

**Resource naming & versioning**
- Resources are named consistently as nouns in a hierarchy of collections — [AIP-122](https://google.aip.dev/122), [AIP-121](https://google.aip.dev/121)
- Use the standard methods (get/list/create/update/delete) before inventing custom actions — [AIP-131](https://google.aip.dev/131)
- A version identifier exists from the start; breaking changes ship only in a new major version — [AIP-185](https://google.aip.dev/185), [AIP-180](https://google.aip.dev/180)
- Stability level (alpha/beta/stable) is stated so consumers know what may change — [AIP-181](https://google.aip.dev/181)

**Errors**
- Error bodies use `application/problem+json` with `type`, `title`, `status`, `detail`, `instance`; keep internals out of `detail` — [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)
- One error shape across the API, with stable machine-readable codes — [AIP-193](https://google.aip.dev/193)

**Pagination, filtering, limits**
- List endpoints are paginated with a default and maximum page size — [AIP-158](https://google.aip.dev/158)
- Filtering is documented and validated server-side — [AIP-160](https://google.aip.dev/160)
- Throttled clients get a back-off signal such as `Retry-After` — [Azure REST API Guidelines](https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md)

**Idempotency**
- Create and other non-idempotent calls accept a client-supplied request ID so retries are safe — [AIP-155](https://google.aip.dev/155), [Azure REST API Guidelines](https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md)
- Retryable errors and retry behaviour are documented for clients — [AIP-194](https://google.aip.dev/194)

**Auth**
- Authorization is checked per object on every request, not only per endpoint (BOLA) — [OWASP API1:2023](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- Needs-evidence: token auth follows OAuth 2.1 (authorization code with PKCE, no implicit grant) with least-privilege scopes, configured in the identity provider — [OAuth 2.1 draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/)
- Permission checks are explicit per operation — [AIP-211](https://google.aip.dev/211)

**Deprecation & sunset**
- Deprecated endpoints send a `Sunset` header with the removal date — [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594)
- opinion: link migration docs from the deprecation notice and remove only after the sunset date has passed.

**Contract**
- opinion: an OpenAPI description is the source of truth, and CI checks code and docs against it.
- opinion: CI runs breaking-change detection on the contract; compatibility rules are in AIP-180.

## Severity hints
Unauthenticated or missing object-level authZ on a data endpoint → High. Unbounded list endpoint on a growing table → Medium. Non-idempotent payment/create call with no request ID → Medium. Missing Sunset header on a deprecation → Low.
