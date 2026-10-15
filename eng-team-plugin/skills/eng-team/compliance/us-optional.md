# Compliance profile: US / international (opt-in only)

Load only when the user states US customers or a specific framework.

- **SOC 2** (Type I/II): controls + evidence + auditor. Map findings to Trust Services Criteria (security always; availability, confidentiality, processing integrity, privacy as scoped). Most SEC/PLT/SRE findings are the evidence base. Policies, access reviews, vendor management → needs-evidence.
- **HIPAA**: triggered by any PHI. BAA with every vendor touching PHI, including hosting, email, error tracking and LLM providers. Access logging of PHI views, minimum necessary, encryption, breach notification rules.
- **PCI DSS**: keep card data out of your systems (PSP-hosted fields/redirect → SAQ A scope). Never log PANs; scan logs and DBs for 13–19 digit Luhn-valid numbers.
- **US state privacy laws** (e.g. CCPA/CPRA): opt-out of sale/sharing, data rights — usually satisfied by a GDPR-grade rights implementation plus "Do Not Sell/Share" handling.
- **Security questionnaires** (SIG, CAIQ): keep answers mapped to evidence produced by this review.
