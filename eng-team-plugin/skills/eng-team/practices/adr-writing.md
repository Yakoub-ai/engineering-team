---
id: adr-writing
kind: practice
status: reviewed
tier: plugin
sources:
  - title: Architectural Decision Records (ADR GitHub organisation)
    url: https://adr.github.io/
    accessed: 2026-10-16
  - title: Documenting Architecture Decisions (Michael Nygard)
    url: https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
    accessed: 2026-10-16
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: always
---
# Practice pack: writing ADRs

Applies to every architectural decision. Look in `docs/engineering/decisions/` (or `docs/adr/` until the project is migrated), `docs/decisions/`, architecture docs, PR descriptions that contain design choices.

**When an ADR is required**
- Plugin policy (eng-team spec section 5.2): write an ADR for a decision affecting cost, data, security or lock-in, or one that is hard to reverse.
- Source definition: keep records for "architecturally significant" decisions, those that affect structure, non-functional characteristics, dependencies, interfaces or construction techniques — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

**Template fields**
- Title: short noun phrase; ADRs are numbered sequentially and monotonically, numbers are never reused — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- Context: the forces at play (technical, political, social, project), described neutrally — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- Decision: the response to those forces, in full sentences, active voice ("We will ...") — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- Consequences: the resulting context, listing all effects, not only the positive ones — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- opinion: record the alternatives considered and why they were rejected, so the decision is not re-litigated.

**Status lifecycle**
- Status is proposed while stakeholders have not agreed, accepted once agreed; a later ADR may mark it deprecated or superseded with a reference to its replacement — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

**Immutability**
- If a decision is reversed, keep the old ADR and mark it superseded; do not rewrite it — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- opinion: typo fixes and a pointer to the superseding ADR are acceptable edits to an accepted ADR.

**Length and style**
- Each ADR covers a single decision and lives in the project repository — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- The whole document is one or two pages, written as a conversation with a future developer — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- Plugin policy (eng-team spec section 7): an ADR is at most 1 page (about 60 lines) and starts with `Audience:` and `Last verified against:`.
- Further ADR templates and tooling are listed at — [ADR GitHub org](https://adr.github.io/)

## Severity hints
Significant decision (new data store, auth model, framework swap) with no ADR → Medium. ADR edited in place instead of superseded → Low. ADR missing consequences or alternatives → Low.
