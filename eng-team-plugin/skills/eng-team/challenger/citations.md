# Citation rules

## Purpose

Make every recommendation, finding and gate decision traceable to a source, so reviewers can check it and so unsupported opinion never blocks work.

## Protocol

**Source priority**

1. Official documentation and standards: vendor docs, RFCs, regulation text on EUR-Lex, OWASP, NIST, W3C.
2. Well-architected frameworks from the cloud vendors.
3. Reputable secondary sources: named authors, dated.

Prefer the highest-priority source that covers the claim. Do not cite a blog where the standard exists.

**Format**

- Web sources: `[title](url) — accessed YYYY-MM-DD`
- Regulation: name the article or clause, for example `GDPR Art. 32(1)(b)`
- Curated packs: `pack:<id>`, for example `pack:twelve-factor`

**No source, no rule.** An uncited claim must be prefixed `opinion:`. An opinion cannot fail a gate or raise a finding's severity above Medium.

**Freshness.** A pack whose `review_by` date is in the past is flagged `stale` in state.md `## Packs in use`. The researcher re-checks it before it can block a gate.

**Never invent URLs.** If a source cannot be fetched or confirmed, say so and downgrade the claim to `opinion:`.

## Output

Citation strings embedded in findings, ADRs, packs and docs, in the formats above.
