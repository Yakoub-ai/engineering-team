# Stack pack: Generic web app (any framework)

Use for Node/Python/.NET/Java/PHP web apps and SPAs when no more specific pack applies — or alongside one.

**Quick recon**
- Manifests & lockfiles: `package.json` + lock, `requirements*.txt`/`pyproject.toml` + lock, `*.csproj`, `pom.xml`/`build.gradle`, `composer.json`. Missing lockfile → finding.
- Framework version vs. end of life (check support status rather than relying on memory).
- Entry points: router files, controllers, `api/` folders, serverless handlers, middleware chain order (auth before handlers?).
- Config: `.env*`, `config/*`, `settings.py`, `appsettings*.json` — secrets, `DEBUG=true`, permissive CORS.

**Framework-specific hotspots**
- Express/Nest: `helmet`, `cors` options, body size limits, `express-rate-limit`, error handler leaking stacks.
- Next.js: server actions & route handlers check auth; secrets not in `NEXT_PUBLIC_*`; middleware isn't the only authZ layer.
- Django/Flask/FastAPI: `DEBUG` off, `ALLOWED_HOSTS`, CSRF middleware, `SECRET_KEY` from env, ORM `raw()`/`extra()` usage, Pydantic/serializer validation on all inputs.
- .NET: `[Authorize]` defaults (fallback policy), anti-forgery, `FromSqlRaw` usage, Data Protection keys persisted.
- Spring: actuator endpoints exposed, method security, `@Valid` on DTOs.
- SPAs: tokens in `localStorage` (XSS-exposed) vs. httpOnly cookies; source maps not public in prod.

**Edge**
- TLS config, HSTS, security headers, cookies flags, CDN caching doesn't cache authenticated responses (`Cache-Control: private/no-store`).
- `robots.txt`/indexing off for staging; `security.txt` present.
