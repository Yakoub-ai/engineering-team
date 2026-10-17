/** Scan cap; mirrors MAX_SCAN in scan.js (not imported, to avoid an import cycle). */
const MAX_SCAN = 512 * 1024;

/**
 * Content-based secret detection. Complements the filename rules in scan.js:
 * a file whose text matches is excluded from the index entirely (see
 * `readIndexable` in scan.js). Every quantifier is bounded (ReDoS).
 *
 * Two tiers:
 *  - token rules: provider-specific, high-confidence formats; applied to every file.
 *  - generic rule: `password = "literal"` style assignments; applied to code/config
 *    only, NOT to `.md` files, because docs routinely describe "password: ..." and
 *    dropping them would hide legitimate engineering record.
 */

/** Values that mark a token as documentation/example rather than a real credential. */
const TOKEN_PLACEHOLDER = /example|xxxx|\*\*\*|your[_-]|dummy|placeholder|redacted/i;
/** Substrings that mark a generic assignment's value as a placeholder or reference. */
const PLACEHOLDERS = [
  '${', '$(', 'process.env', 'os.environ', '<', '{{', 'example', 'changeme', 'xxx', '***',
  'your_', 'dummy', 'test', 'placeholder', 'redacted',
];

const PEM = /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----[\s\S]{0,300}?[A-Za-z0-9+/]{40}/;
const GCP_TYPE = /"type"\s{0,10}:\s{0,10}"service_account"/;
const GCP_KEY = /"private_key"/;

/** Provider token rules: [rule, regex, optional extra check on the matched text]. */
const TOKEN_RULES = [
  ['aws-access-key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{36}\b/],
  ['github-token', /\bgithub_pat_[A-Za-z0-9_]{22,100}/],
  ['slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,100}/],
  ['stripe-key', /\b[sr]k_live_[A-Za-z0-9]{16,100}/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,200}/],
  // Real keys mix letters and digits; this skips CSS-ish names such as "sk-some-long-class-name".
  ['openai-key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,200}/, (m) => /\d/.test(m) && /[A-Za-z]/.test(m.slice(3))],
];

const KEYWORD = '(?:password|passwd|secret|api[_-]?key|apikey|token|private[_-]?key|client[_-]?secret)';
const ASSIGN = new RegExp(
  `${KEYWORD}[\\w.-]{0,30}["']?[ \\t]{0,5}[:=][ \\t]{0,5}(?:"([^"\\s]{8,200})"|'([^'\\s]{8,200})'|([^\\s"',;(){}\\[\\]]{8,200}))`,
  'gi',
);

function isPlaceholder(value) {
  const lower = value.toLowerCase();
  return PLACEHOLDERS.some((p) => lower.includes(p));
}

function tokenRule(text) {
  for (const [rule, re, check] of TOKEN_RULES) {
    const m = re.exec(text);
    if (m && !TOKEN_PLACEHOLDER.test(m[0]) && (!check || check(m[0]))) return rule;
  }
  if (PEM.test(text)) return 'pem-private-key';
  if (GCP_TYPE.test(text) && GCP_KEY.test(text)) return 'gcp-service-account';
  return null;
}

function genericRule(text) {
  for (const m of text.matchAll(ASSIGN)) {
    const quoted = m[1] ?? m[2];
    const value = quoted ?? m[3];
    if (isPlaceholder(value)) continue;
    if (/^\d+$/.test(value)) continue;
    // Bare values need a digit: skips type names and identifiers (`password: requiredString`).
    if (quoted === undefined && !/\d/.test(value)) continue;
    return 'generic-secret-assignment';
  }
  return null;
}

/**
 * Look for credentials in file text (first 512 KB only). Never returns or logs the secret.
 * @param {string} text
 * @param {{generic?: boolean}} [opts] generic: also apply the keyword-assignment rule (default true; off for docs)
 * @returns {{rule: string}|null}
 */
export function containsSecret(text, { generic = true } = {}) {
  const head = text.length > MAX_SCAN ? text.slice(0, MAX_SCAN) : text;
  const rule = tokenRule(head) || (generic ? genericRule(head) : null);
  return rule ? { rule } : null;
}
