# planted-api — Brief

Audience: business stakeholders and sponsors (no jargon)
Last verified against: 0000000

## Problem
Small businesses send and check invoices by email and spreadsheet. Customers cannot look up their own invoices, and errors are found late.

## Proposed solution
A small web API that lets each business sign up and view its own invoices. Customers sign up once, then fetch an invoice by its number.

## Cost and risk
Low running cost (one small service). Top risks: invoice data seen by the wrong customer, payment credentials leaking, personal data kept longer than needed.

## Decisions needed
1. Payment provider: use a hosted payment provider (recommended) so card data never touches this service.

## Status
Build and test phases passed on 2026-10-16. Documentation is next.
