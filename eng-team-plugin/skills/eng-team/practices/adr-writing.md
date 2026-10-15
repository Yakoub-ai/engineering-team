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

Applies to every architectural decision. Look in `docs/adr/`, `docs/decisions/`, architecture docs, PR descriptions that contain design choices.

**When an ADR is required**
- Write one for each architecturally significant decision: one that affects structure, non-functional characteristics, dependencies, interfaces or construction techniques — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions), [ADR GitHub org](https://adr.github.io/)
- Significant-decision test (plugin spec section 5.2): hard to reverse, affects more than one team or component, or introduces a new dependency or data store — [ADR GitHub org](https://adr.github.io/)

**Template fields**
- Title: short noun phrase, numbered sequentially and monotonically; numbers are never reused — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- Context: the forces at play (technical, political, social, project), stated neutrally — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- Decision: the response to those forces, in full sentences, active voice ("We will ...") — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- Consequences: the resulting context, listing all effects, not only the positive ones — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- Alternatives considered are recorded so the decision is not re-litigated — [ADR GitHub org](https://adr.github.io/)

**Status lifecycle**
- Status is proposed while stakeholders have not agreed, accepted once agreed; later deprecated or superseded with a reference to the replacement — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

**Immutability**
- An accepted ADR is not edited to change the decision; write a new ADR and mark the old one superseded, keeping it for history — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- Fixing typos or adding a pointer to the superseding ADR is fine — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

**Length and style**
- Keep the whole ADR to one or two pages (this plugin: at most 1 page, about 60 lines) — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- Write it as a conversation with a future developer; one decision per ADR; stored in version control with the code — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions), [ADR GitHub org](https://adr.github.io/)

## Severity hints
Significant decision (new data store, auth model, framework swap) with no ADR → Medium. ADR edited in place instead of superseded → Low. ADR missing consequences or alternatives → Low.
