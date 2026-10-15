---
id: wordpress
kind: stack
status: reviewed
tier: plugin
sources:
  - title: WordPress hardening
    url: https://developer.wordpress.org/advanced-administration/security/hardening/
    accessed: 2026-10-15
reviewed_by: George Yakoub
review_by: 2027-04-15
applies_when: profile.stacks contains "wordpress"
---
# Stack pack: WordPress (incl. JetEngine/Crocoblock-style builds)

Look in `wp-config.php`, `wp-content/themes/*`, `wp-content/plugins/*` (custom ones especially), `mu-plugins`, `.htaccess`/nginx config, `composer.json`, deploy scripts.

**Core hygiene (SEC/PLT)**
- Core, themes and plugins up to date; auto-updates for minor/security releases. Flag plugins closed on wordpress.org, abandoned (no update > 1 year), or **nulled/pirated** (common malware vector).
- Plugin count and overlap: each plugin is attack surface — flag unused/inactive plugins still installed.
- `wp-config.php`: unique salts, DB creds not in repo (env/secret store), `DISALLOW_FILE_EDIT` true, `WP_DEBUG` false in prod (and `WP_DEBUG_LOG` not publicly reachable), `FORCE_SSL_ADMIN`.
- File permissions: no PHP execution in `wp-content/uploads`; `wp-config.php` not world-readable.
- XML-RPC disabled unless required; user enumeration blocked (`?author=`, REST `/wp/v2/users`); login rate-limited; 2FA for all admin/editor accounts; no `admin` username.
- WAF/CDN in front (Cloudflare, Wordfence or host WAF) and malware scanning.

**Custom code (SEC)**
- Every AJAX/REST/form handler checks **nonce + capability** (`check_ajax_referer`/`wp_verify_nonce` + `current_user_can`). `permission_callback => '__return_true'` on REST routes that change or expose data → finding.
- DB access via `$wpdb->prepare()`; output via `esc_html`/`esc_attr`/`esc_url`/`wp_kses`; input via `sanitize_*`.
- JetEngine/listing queries, dynamic tags and REST exposures don't leak private CPT/meta fields (check query visibility and REST `show_in_rest` on sensitive post types/meta).
- File uploads via WP APIs with type checks.

**Data & privacy (CMP)**
- Contact/form plugins storing submissions in DB → retention + export/erase hooks (WP privacy tools) wired up.
- Analytics/marketing scripts gated by consent (CMP) before load; cookie list matches reality.
- Hosting and backup location in the EU if required; email sending via authenticated SMTP/API with SPF/DKIM/DMARC.

**Ops (PLT/SRE)**
- `DISABLE_WP_CRON` true + real system cron for reliability; backups off-server with tested restore; staging environment that isn't indexed and isn't using live personal data.
- Uptime monitoring; admin accounts reviewed; client owns the domain, hosting and plugin licences (not the consultant).
