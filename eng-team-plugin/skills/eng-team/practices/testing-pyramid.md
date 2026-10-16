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
  - title: Eradicating Non-Determinism in Tests (Martin Fowler)
    url: https://martinfowler.com/articles/nonDeterminism.html
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
- Avoid an inverted pyramid (many slow e2e tests, few unit tests) — [Google Testing Blog](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)

**What each layer must prove**
- Unit: business logic and edge cases in isolation, fast and deterministic — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- Integration: the code works against real collaborators (database, queue, HTTP client) at the boundary — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- End-to-end: a few critical user journeys work through the deployed system — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html), [Google Testing Blog](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)

**Contract tests**
- Contract tests (consumer-driven where practical) check the interface between a service and its consumers, complementing integration and e2e tests — [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

**Test data hygiene**
- opinion: tests create and clean up their own data and do not depend on execution order or shared mutable state.
- opinion: fixtures are synthetic; production personal data is not copied into test data (data minimisation, see pack:eu-gdpr).

**Flaky tests**
- Non-deterministic tests are tracked, quarantined out of the main suite and fixed, not left to erode trust in the build — [Fowler: Eradicating Non-Determinism](https://martinfowler.com/articles/nonDeterminism.html)
- Broad end-to-end tests are slow and flaky, and give late feedback with hard-to-find root causes — [Google Testing Blog](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)

**Assert outcomes, not mocks**
- opinion: tests assert observable results (return values, state, emitted output), not that internal methods were called.
- opinion: mock only at true boundaries; a test made only of mocks proves nothing about the real integration.

## Severity hints
No tests on payment, auth or data-deletion paths → High. Production personal data in fixtures → High. Inverted pyramid or unquarantined flaky suite blocking CI → Medium. Over-mocked tests that assert call counts only → Low.
