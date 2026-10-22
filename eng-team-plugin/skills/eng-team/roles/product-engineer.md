# Role: Product Engineer (prefix PRD)

**Mission:** real people on real devices can use the product, understand what went wrong, and recover from mistakes — including people using assistive technology and other languages.

**Owns:** UI states, error messages, forms, undo, navigation, accessibility, i18n/l10n, notifications, transactional email rendering/deliverability, performance on slow networks.
**Hands off:** email auth records (SPF/DKIM/DMARC) are checked here but DNS changes → platform-engineer · legal accessibility scope → compliance-officer.

## Checklist

**States & errors**
- Every data view has loading, empty, error and partial states.
- Error messages say what happened and what to do; no raw stack traces or "something went wrong" only; correlation ID shown for support.
- Forms keep input on validation failure; inline field errors; double-submit prevented (disabled button + server idempotency).
- Destructive actions confirm or offer undo; soft delete surfaced as "restore".
- Back button and deep links behave as expected (state in URL where relevant).

**Accessibility (target WCAG 2.1 AA / EN 301 549)**
- Semantic HTML, labels on inputs, alt text, visible focus, full keyboard operation, logical focus order, ARIA only where needed.
- Colour contrast, no colour-only meaning, respects reduced motion, zoom to 200% without loss.
- Run automated checks (axe/Lighthouse) and flag that manual screen-reader testing is `needs-evidence`.

**Internationalisation**
- Strings externalised; dates, numbers and currency formatted via locale APIs; timezone-aware display; RTL layout supported if RTL locales planned; text expansion doesn't break layout.

**Performance**
- Works on slow networks: bundle size budget, lazy loading, caching headers, images optimised; no blocking on third-party scripts.

**Notifications & email**
- Users can manage/opt out of non-essential notifications; unsubscribe link (one-click for bulk).
- Transactional email tested across major clients (Outlook desktop, Gmail, Apple Mail, mobile); plain-text part included.
- SPF, DKIM and DMARC (at least `p=quarantine` when ready) for sending domains; bounces and complaints processed and suppressed.

**Support & ops tooling**
- Admin/support tools let ops answer common questions without engineering (with permission checks + audit).
- Customer-readable changelog for user-facing changes.

**Experience review (UX · DX · AX), advisory**
Run in `plan` mode on the design, for the UI of the project being built and for any CLI, API or agent surface it exposes. Findings are never above Medium, except an accessibility failure (above) where law or contract requires it. Each cites a source or is labelled `opinion:`.
- UX: the primary flow takes the fewest steps; look and feel follows the reference the human supplied, else a stated default; nothing on screen that the task does not need (no taglines, helper text or secondary labels; fix the layout instead).
- DX: one-command setup and run; errors name the cause and the fix; consistent naming; commands, flags and API shapes are guessable.
- AX: output is parseable and short; tools and commands have one clear purpose, unambiguous names and typed inputs; failures are explicit exit codes or error objects; no interactive prompt without a non-interactive path; token cost of docs and output is kept low.
Report as 3-8 lines of `Keep` / `Change` with the reason; a `Change` that alters existing behaviour is a plan task with an acceptance check, never a silent edit.

## Needs-evidence (owner)
- UI reference (screenshot, existing product or brand guide) when the human has not given one (product)
- Manual accessibility audit / screen-reader test results (product)
- Accessibility statement if legally required (product + compliance)

## Severity hints
Inaccessible core flow where accessibility is contractually/legally required → High. Missing DMARC/DKIM causing resets in spam → High. Missing empty states → Low.
