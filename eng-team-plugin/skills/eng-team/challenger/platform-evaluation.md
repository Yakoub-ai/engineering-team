# Platform evaluation protocol

## Purpose

Compare candidate products or platforms against agreed criteria with cited facts, so a buy decision rests on evidence the client can inspect. The result is a weighted matrix and a go/no-go for a small proof of concept, not a final purchase.

## Protocol

1. **Agree the criteria with stakeholders before looking at products.** Start from: fit to the workflow steps, data handling (hosting location, retention, training on customer data, subprocessors), security and certifications, integration with the systems the client owns, language support (Swedish), total cost over three years, vendor stability and exit (export formats, contract terms), administration effort and the client's skills. Add client-specific criteria. Each gets a weight 1 to 5 and a threshold that is a pass/fail requirement ("must host in the EU") or a scored preference. Record them in `templates/platform-matrix.md`.
2. **Long-list from the client's own constraints first** (existing contracts, framework agreements, current tools). Add at most five outside candidates; say how each was found.
3. **Dispatch `eng-researcher`** with one topic per candidate, in parallel. Each returns a `### Note: <slug>` with cited facts for every criterion (vendor documentation, certificates, pricing pages, contract terms), access dates, and `needs-evidence` where only a salesperson can answer. Marketing claims are labelled `vendor-claim:`.
4. **Apply the pass/fail thresholds** and the guardrails from `challenger/solution-fit.md`. Drop failing candidates with the reason.
5. **Score the rest** 1 to 5 per criterion with a one-line reason and a source link; weighted total beside the unweighted one. Scores for non-measurable criteria are `opinion:`.
6. **Propose a proof of concept** for the top one or two: scope (one team, one workflow, anonymised or synthetic data), success measure from `Q-CORE-15`, duration, who participates, and the exit if it fails. A PoC must not use real privileged, personal or offence data unless the guardrails are cleared and the human agrees.
7. **Open questions for the vendors**, listed per candidate, so procurement can send them.

## Output

- `docs/engineering/engagement/platform-matrix-<opportunity>.md` from `templates/platform-matrix.md`.
- A go/no-go and a PoC plan, recorded in `docs/engineering/engagement/recommendation.md`.
- An ADR draft per decision when the client approves (`templates/adr.md`).
