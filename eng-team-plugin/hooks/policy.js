'use strict';
/**
 * eng-team repo policy (.eng-team/policy.json) and human-intent grants.
 *
 * The policy can only add to the plugin's fixed baseline in guard.js. A
 * missing or invalid policy means the strictest defaults (gated, autonomous
 * off). Grants record that the human typed a command (UserPromptExpansion
 * fires only for user-typed commands); they live outside the project in
 * ~/.eng-team/grants/, which the guard protects. Zero dependencies, Node 18+.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const POLICY_FILE = path.join('.eng-team', 'policy.json');
const MODES = ['gated', 'autonomous'];
const DEFAULTS = Object.freeze({
  version: 1,
  max_mode: 'gated',
  human_required_paths: [],
  destructive_extra: [],
  credentials_scoped: false,
  approval_ttl_hours: 24,
});
const GRANT_TTL_MS = { policy: 30 * 60 * 1000, autonomous: 24 * 60 * 60 * 1000, skip: 10 * 60 * 1000, force: 10 * 60 * 1000 };

const isStrList = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string' && s.trim() !== '' && s.length <= 200);

/**
 * @param {unknown} p parsed policy
 * @returns {string[]} problems; empty when valid
 */
function validate(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['policy must be a JSON object'];
  const errs = [];
  for (const k of Object.keys(p)) if (!(k in DEFAULTS)) errs.push(`unknown key "${k}"`);
  if (p.version !== 1) errs.push('version must be 1');
  if (!MODES.includes(p.max_mode)) errs.push(`max_mode must be one of ${MODES.join(', ')}`);
  for (const k of ['human_required_paths', 'destructive_extra'])
    if (k in p && !isStrList(p[k])) errs.push(`${k} must be a list of non-empty strings`);
  if ('credentials_scoped' in p && typeof p.credentials_scoped !== 'boolean') errs.push('credentials_scoped must be true or false');
  if ('approval_ttl_hours' in p && !(Number.isInteger(p.approval_ttl_hours) && p.approval_ttl_hours >= 1 && p.approval_ttl_hours <= 168))
    errs.push('approval_ttl_hours must be a whole number from 1 to 168');
  return errs;
}

/** Fill optional fields with defaults. */
const normalize = (p) => ({ ...DEFAULTS, ...p });

/**
 * @param {string} root project directory
 * @returns {{policy: object, state: 'ok'|'missing'|'invalid', errors: string[]}}
 */
function readPolicy(root) {
  let raw;
  try {
    raw = fs.readFileSync(path.join(root, POLICY_FILE), 'utf8');
  } catch {
    return { policy: { ...DEFAULTS }, state: 'missing', errors: [] };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { policy: { ...DEFAULTS }, state: 'invalid', errors: [`not valid JSON (${e.message})`] };
  }
  const errors = validate(parsed);
  return errors.length ? { policy: { ...DEFAULTS }, state: 'invalid', errors } : { policy: normalize(parsed), state: 'ok', errors: [] };
}

/**
 * What a change gives up. Anything listed here loosens the policy.
 * @returns {string[]}
 */
function loosenings(before, after) {
  const a = normalize(before);
  const b = normalize(after);
  const out = [];
  if (MODES.indexOf(b.max_mode) > MODES.indexOf(a.max_mode)) out.push(`max_mode ${a.max_mode} → ${b.max_mode}`);
  for (const k of ['human_required_paths', 'destructive_extra']) {
    const gone = a[k].filter((x) => !b[k].includes(x));
    if (gone.length) out.push(`${k} removes ${gone.map((x) => JSON.stringify(x)).join(', ')}`);
  }
  if (!a.credentials_scoped && b.credentials_scoped) out.push('credentials_scoped false → true');
  if (b.approval_ttl_hours > a.approval_ttl_hours) out.push(`approval_ttl_hours ${a.approval_ttl_hours} → ${b.approval_ttl_hours}`);
  return out;
}

// ---------------------------------------------------------------- grants

const engHome = () => path.join(process.env.ENG_TEAM_HOME || os.homedir(), '.eng-team');
const grantFile = (sessionId, kind) =>
  path.join(engHome(), 'grants', `${crypto.createHash('sha256').update(String(sessionId)).digest('hex').slice(0, 32)}-${kind}.json`);

/** Record that the human typed a command granting `kind` for this session. */
function writeGrant(sessionId, kind, now = Date.now()) {
  if (!sessionId || !(kind in GRANT_TTL_MS)) return false;
  const f = grantFile(sessionId, kind);
  fs.mkdirSync(path.dirname(f), { recursive: true, mode: 0o700 });
  fs.writeFileSync(f, JSON.stringify({ kind, expires: now + GRANT_TTL_MS[kind] }), { mode: 0o600 });
  return true;
}

/** @returns {boolean} an unexpired grant of `kind` exists for this session */
function hasGrant(sessionId, kind, now = Date.now()) {
  if (!sessionId) return false;
  try {
    const g = JSON.parse(fs.readFileSync(grantFile(sessionId, kind), 'utf8'));
    return g.kind === kind && typeof g.expires === 'number' && g.expires > now && g.expires <= now + GRANT_TTL_MS[kind];
  } catch {
    return false;
  }
}

module.exports = { DEFAULTS, POLICY_FILE, validate, readPolicy, loosenings, engHome, writeGrant, hasGrant };
