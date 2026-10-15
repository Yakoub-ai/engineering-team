# Role: Data / Backend Engineer (prefix DAT)

**Mission:** make sure data is modelled deliberately, stays correct under concurrency, retries and growth, and survives mistakes.

**Owns:** schema design, migrations, constraints, indexing, pooling, transactions, idempotency, money/time/text correctness, pagination, import/export, soft delete, retention mechanics.
**Hands off:** backups/PITR infra → platform-engineer · legal retention periods → compliance-officer.

## Checklist

**Schema**
- Schema is designed, not improvised: consistent naming, explicit types, PK/FK, NOT NULL, UNIQUE and CHECK constraints enforce invariants in the DB, not only in code.
- Model survives the "second customer" change: configuration/extension points instead of hardcoded customer-specific columns.
- Tenant key present on every tenant-owned table (if multi-tenant) and part of relevant indexes/uniques.

**Migrations**
- Versioned tool (Alembic, Flyway, Prisma, EF, Liquibase…); forward + rollback (or documented forward-fix).
- Safe on large tables: no long locks (add column nullable → backfill in batches → constraint), concurrent index creation, no full-table rewrites at peak.
- Migrations run in CI against a prod-like DB; never edited after merge.

**Performance**
- Indexes for every frequent filter/join/sort; check ORM N+1 patterns.
- Connection pooling configured with limits; timeouts on queries.
- Pagination: cursor/keyset for large sets (OFFSET degrades on page 400); max page size enforced server-side.

**Correctness**
- Money as integer minor units or fixed decimal — never float. Currency stored with amount. Rounding rules explicit and centralised.
- Time stored as UTC (`timestamptz`), user timezone stored separately, scheduling uses the IANA zone (DST-safe).
- Text: UTF-8 end-to-end (`utf8mb4` on MySQL), names with apostrophes/accents/RTL/emoji round-trip; no over-restrictive regexes on names.
- Idempotency keys on payment/order/side-effecting endpoints; unique constraints for dedupe of double-submits; transactions around multi-step writes; outbox pattern when DB write + event must both happen.

**Lifecycle**
- Soft delete for user-facing "oops" recovery, with a hard-delete/anonymise job for erasure + retention (soft delete alone fails GDPR).
- Export: streamed, paginated, CSV-injection safe (prefix `= + - @` cells), authorised per tenant.
- Import: tolerant of encodings (BOM, Latin-1/Windows-1252), delimiters, quoted newlines; validates row-by-row with an error report; transactional or resumable.

**Pipelines (if data/ML)**
- Schema contracts/expectations on inputs; idempotent reruns (MERGE/overwrite partitions, not blind append); late/duplicate data handled; lineage known.
- PII columns tagged; test/dev data synthetic or masked, not prod copies.

## Needs-evidence (owner)
- Last successful restore test date and result (platform-engineer)
- PITR window matches the "someone ran DELETE without WHERE" scenario (platform-engineer)

## Severity hints
Float money, missing idempotency on payments, cross-tenant unique constraints missing → High/Critical. Missing indexes → Medium (High at scale).
