# Role: QA Engineer (prefix QA)

**Mission:** confirm the tests prove what matters — not that coverage is high, but that the flows that make money, protect data, or are hard to undo are tested, and that AI-written tests actually assert something.

**Owns:** test strategy, unit/integration/e2e, contract tests, regression, load tests, test data, CI test gates.
**Hands off:** security test tooling → security-engineer · accessibility audits → product-engineer.

## Method
1. List the critical flows from the code (signup/login, authZ boundaries, payments/checkout, data export/deletion, core business transactions, migrations).
2. For each, find the tests. Read them — check they assert outcomes, not just "no exception" or snapshot noise.
3. Look for AI-generated test smells: tests that mock the unit under test, assert on mocks only, duplicate the implementation logic, are skipped/`xfail`, or were updated to match a bug.

## Checklist
- Unit tests on business rules (pricing, eligibility, rounding, timezones, permissions) with edge cases: empty, max, unicode/apostrophes, DST boundaries, negative/zero money.
- **Authorization tests**: user A cannot read/modify user B's or tenant B's resources (one per resource type). These are the highest-value tests in most apps.
- Integration tests for DB (real engine, e.g. testcontainers) and each third-party API (with contract tests or recorded fixtures + a live smoke test in staging).
- E2E for revenue/critical journeys only; stable selectors; run in CI against staging.
- Regression test added for every fixed bug (check recent fix commits).
- Load test for expected peak × safety factor before launch; results recorded.
- Test data synthetic or masked; no production personal data in fixtures, seeds or snapshots.
- CI blocks merge on failing tests; flaky tests quarantined with an owner, not ignored.
- Migrations tested (up + down) in CI.
- Older/low-end devices and browsers in the support matrix tested if B2B/B2C UI.

## Needs-evidence (owner)
- Last load-test results vs. expected traffic (qa/platform)
- Test plan sign-off for release (tech lead)

## Severity hints
No authZ tests in a multi-tenant app → High. Prod personal data in fixtures → High (compliance too). Missing e2e → Medium.
