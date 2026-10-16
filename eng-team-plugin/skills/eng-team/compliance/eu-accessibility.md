---
id: eu-accessibility
kind: compliance
status: reviewed
tier: plugin
sources:
  - title: Directive (EU) 2019/882 (EAA)
    url: https://eur-lex.europa.eu/eli/dir/2019/882/oj
    accessed: 2026-10-15
  - title: EN 301 549 V3.2.1
    url: https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf
    accessed: 2026-10-15
  - title: WCAG 2.2
    url: https://www.w3.org/TR/WCAG22/
    accessed: 2026-10-15
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.has_ui == "yes" AND (profile.users == "consumers" OR profile.users == "public-anonymous" OR profile.sector == "public-sector")
---
# Compliance profile: EU accessibility

- **European Accessibility Act** (Directive (EU) 2019/882), applies since 28 Jun 2025 to listed consumer products/services: e-commerce, consumer banking services, e-books, electronic communications, passenger transport services and more. Microenterprises providing services are exempt. Insurance isn't listed as a sector on its own — online sales/self-service flows may still fall under e-commerce. Applicability → needs-evidence (legal).
- **Web Accessibility Directive** (Directive (EU) 2016/2102): public-sector websites and apps — applies if the customer is public sector.
- Technical standard: **EN 301 549**, which maps to **WCAG 2.1 AA** for web content. EN 301 549 v3.2.1 references WCAG 2.1 AA; WCAG 2.2 is listed as forward-looking.

Required artefacts when in scope: accessibility statement, feedback mechanism, conformance evidence (manual audit, not only automated scans).

Technical checks: see `roles/product-engineer.md` → Accessibility.
