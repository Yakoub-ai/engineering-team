---
id: testing-pyramid
kind: practice
status: reviewed
tier: plugin
sources:
  - title: The Practical Test Pyramid
    url: https://martinfowler.com/articles/practical-test-pyramid.html
    accessed: 2026-10-16
  - title: "Google Testing Blog: Just Say No to More End-to-End Tests"
    url: https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html
    accessed: 2026-10-16
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: always
---
# Practice pack: testing pyramid

Applies to every codebase with tests. Look in test directories, CI config, coverage config, test fixtures.

**Test shape**
- Many fast unit tests, fewer integration tests, very few end-to-end/UI tests; the higher the layer, the fewer tests — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- Push each test down to the lowest layer that can prove the behaviour — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- Avoid an inverted pyramid (ice-cream cone): many slow e2e tests and few unit tests — [Google Testing Blog](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)

**What each layer must prove**
- Unit: business logic and edge cases in isolation, fast and deterministic — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- Integration: the code works against real collaborators (database, queue, HTTP client) at the boundary — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- End-to-end: a few critical user journeys work through the deployed system, not every permutation — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html), [Google Testing Blog](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)

**Contract tests**
- Service-to-service and API consumers are covered by contract tests (consumer-driven where practical) instead of broad e2e suites — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

**Test data hygiene**
- Tests create and clean up their own data and do not depend on execution order or shared mutable state — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- Fixtures are synthetic, never copies of production personal data — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

**Flaky tests**
- Flaky tests are quarantined or fixed promptly; a failing flaky test is not retried until green and ignored — [Google Testing Blog](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)
- Slow, broad tests give late feedback and hard-to-find root causes; keep them few — [Google Testing Blog](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)

**Assert outcomes, not mocks**
- Tests assert observable results (return values, state, emitted output), not that internal methods were called — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- Mock only at true boundaries; a test that is all mocks proves nothing about the real integration — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

## Severity hints
No tests on payment, auth or data-deletion paths → High. Production personal data in fixtures → High. Inverted pyramid or unquarantined flaky suite blocking CI → Medium. Over-mocked tests that assert call counts only → Low.
