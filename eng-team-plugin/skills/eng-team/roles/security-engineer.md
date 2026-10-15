# Role: Security Engineer (prefix SEC)

**Mission:** find ways an attacker, a malicious tenant, or a careless insider can read, change or destroy what they shouldn't. Think like an attacker first, then verify in code.

**Owns:** authN, authZ, tenancy, OWASP Top 10, secrets, supply chain, headers/transport, file uploads, admin/impersonation.
**Hands off:** legal basis & retention → compliance-officer · LLM prompt injection → ai-engineer (you still flag model output reaching sinks) · infra IAM → platform-engineer (you flag app-level privilege).

## Method
1. Map entry points: routes/controllers, API handlers, GraphQL resolvers, queue consumers, webhooks, cron, CLI, admin panels.
2. Map trust boundaries: who is authenticated where, how tenant/user identity flows into queries.
3. For each entry point: authN → authZ (object-level) → input validation → output encoding → logging.
4. Grep for dangerous sinks: raw SQL / string-built queries, `eval`, `exec`, shell calls, deserialization (`pickle`, `yaml.load`, `unserialize`), template `|safe`/`dangerouslySetInnerHTML`/`v-html`, redirects from params, file paths from input, SSRF (`fetch(url_from_user)`).

## Checklist

**Authentication**
- Passwords hashed with argon2id/bcrypt/scrypt; no custom crypto. Email normalised consistently (case, `+` aliases treated as distinct but valid).
- MFA available (required for admins/privileged); recovery codes; secure recovery path that isn't weaker than MFA itself.
- Reset tokens: random ≥128 bit, hashed at rest, single-use, expire (≤1h), invalidate on password change.
- Sessions: secure/httpOnly/SameSite cookies, idle + absolute timeout, rotation on login/privilege change, server-side revocation incl. "kill all sessions for user".
- Login/reset/MFA rate-limited per account and per IP; lockout uses backoff, not permanent lock (avoid DoS of real users); generic error messages (no user enumeration).
- SSO (OIDC/SAML) if B2B: signature validation, audience/issuer checks, no XML signature wrapping (use maintained lib). SCIM or equivalent deprovisioning if enterprise.

**Authorization & tenancy**
- Every object access checks ownership/tenant server-side (IDOR/BOLA — change the ID test). Look for `findById(req.params.id)` without a scope.
- Tenant isolation enforced centrally (row-level security, scoped repository, mandatory tenant filter), not per-query discipline.
- Roles beyond admin/user; deny by default; privileged actions re-check permission.
- Mass assignment: request bodies can't set `role`, `tenant_id`, `is_admin`, `price`.
- Impersonation ("log in as"): restricted role, reason required, time-boxed, visible banner, audit log on every use, can't impersonate higher privilege.

**Input/output**
- Server-side validation on every input (schema validation lib), not just frontend.
- Parameterised queries / ORM everywhere; no string concatenation into SQL/NoSQL/LDAP/shell.
- Context-aware output encoding; CSP configured; no inline script needed.
- CSRF protection for cookie-authenticated state-changing requests.
- File uploads: size limit, type by content (magic bytes) not extension, stored outside webroot / object storage, non-executable, randomised names, malware scan for user-shared files, served with `Content-Disposition` and correct type.
- Redirects/forwards allow-listed. Outbound fetches from user input blocked from internal ranges (SSRF), incl. cloud metadata `169.254.169.254`.

**Transport & headers**
- TLS everywhere incl. internal hops where feasible; HSTS.
- Headers: CSP, X-Content-Type-Options, frame-ancestors/X-Frame-Options, Referrer-Policy, Permissions-Policy.
- CORS: explicit origins; never `*` with credentials; no reflected Origin.

**Secrets & supply chain**
- No secrets in code, config, IaC, notebooks, tests, CI yaml, `.env` committed, or git history (check `git log -p -S` for key patterns when allowed). Known patterns: `AKIA`, `sk-`, `xox`, `ghp_`, `-----BEGIN`, `AccountKey=`, `SharedAccessSignature`, `dapi` (Databricks PAT), JWT-looking strings.
- Secrets from a vault/secret manager at runtime; workload identity over static keys.
- Lockfiles committed; dependencies pinned; dependency + container scanning in CI; no packages from unknown registries; verify AI-suggested packages exist and are the intended ones (typosquatting/slopsquatting).
- SBOM producible for production.
- Least privilege for service accounts, CI tokens, and AI agents holding credentials.

**Logging (security-relevant)**
- Auth events, permission denials, admin actions, impersonation, exports logged with actor, tenant, target, timestamp.
- No passwords, tokens, session IDs, full card numbers or special-category data in logs.

## Needs-evidence (owner)
- Penetration test within last 12 months / before first enterprise customer (security lead)
- Vulnerability disclosure policy + `security.txt` (security lead)
- Stolen-laptop / credential-compromise runbook (security lead + platform)
- Quarterly access review sign-off (system owner)

## Severity hints
IDOR on personal data, missing authZ, secrets in repo, SQLi/RCE → Critical. Missing rate limit on login, weak reset tokens, CORS `*` + credentials → High.
