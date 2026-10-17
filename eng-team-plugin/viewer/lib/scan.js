import fs from 'node:fs';
import path from 'node:path';

export const MAX_BYTES = 512 * 1024;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build']);
const LOCKFILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'poetry.lock', 'Cargo.lock', 'composer.lock', 'Gemfile.lock']);
const CODE_EXT = new Set([
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'go', 'rb', 'java', 'kt', 'cs', 'php', 'rs',
  'sh', 'sql', 'tf', 'yaml', 'yml', 'toml', 'json',
]);

/**
 * Classify a project-relative posix path.
 * @param {string} rel
 * @returns {{type: 'doc'|'code'|'state', kind: string}|null} null when not indexed
 */
export function classify(rel) {
  if (rel === '.eng-team/state.md') return { type: 'state', kind: 'state' };
  const base = path.posix.basename(rel);
  if (LOCKFILES.has(base) || base.endsWith('.lock')) return null;
  if (rel.endsWith('.md')) return { type: 'doc', kind: docKind(rel) };
  const ext = path.posix.extname(base).slice(1).toLowerCase();
  if (base === 'Dockerfile' || CODE_EXT.has(ext)) return { type: 'code', kind: 'code' };
  return null;
}

function docKind(rel) {
  if (rel === 'docs/engineering/STATUS.md') return 'status';
  if (rel === 'docs/engineering/team-plan.md') return 'team-plan';
  const dirs = [['handovers', 'handover'], ['decisions', 'decision'], ['specs', 'spec'], ['plans', 'plan']];
  for (const [dir, kind] of dirs) {
    if (new RegExp(`^docs/engineering/${dir}/[^/]+\\.md$`).test(rel)) return kind;
  }
  return 'doc';
}

function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      while (glob[i + 2] === '*') i++;
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i++;
      }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return re;
}

/**
 * Parse root .gitignore text (simple glob subset, negations ignored).
 * @param {string} text
 * @returns {(rel: string, isDir: boolean) => boolean}
 */
export function parseGitignore(text) {
  const rules = [];
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.startsWith('/') || line.includes('/');
    line = line.replace(/^\//, '');
    const body = globToRegex(line);
    rules.push({ dirOnly, re: new RegExp(anchored ? `^${body}$` : `(^|/)${body}$`) });
  }
  return (rel, isDir) => rules.some((r) => (!r.dirOnly || isDir) && r.re.test(rel));
}

function isSecretName(name) {
  return name.startsWith('.env') || name.endsWith('.pem') || name.endsWith('.key') || name.startsWith('id_rsa');
}

/**
 * Walk a project and list indexable files (spec B8 exclusions applied).
 * @param {string} root absolute project dir
 * @returns {{path: string, abs: string, type: string, kind: string, size: number, mtime: number}[]}
 */
export function scanProject(root) {
  let ignored = () => false;
  try {
    ignored = parseGitignore(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'));
  } catch { /* no .gitignore */ }
  const out = [];
  walk(root, '', ignored, out);
  return out.sort((a, b) => (a.path < b.path ? -1 : 1));
}

function walk(root, relDir, ignored, out) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, relDir), { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
    if (ent.isSymbolicLink()) continue;
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name) || isSecretName(ent.name) || rel === '.eng-team/.cache' || ignored(rel, true)) continue;
      walk(root, rel, ignored, out);
    } else if (ent.isFile()) {
      addFile(root, rel, ent.name, ignored, out);
    }
  }
}

function addFile(root, rel, name, ignored, out) {
  if (isSecretName(name) || ignored(rel, false)) return;
  const cls = classify(rel);
  if (!cls) return;
  const abs = path.join(root, rel);
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    return;
  }
  if (st.size > MAX_BYTES) return;
  out.push({ path: rel, abs, ...cls, size: st.size, mtime: Math.floor(st.mtimeMs) });
}

/**
 * Read a file as UTF-8 text; null when unreadable or binary (contains NUL).
 * @param {string} abs
 * @returns {string|null}
 */
export function readText(abs) {
  try {
    const buf = fs.readFileSync(abs);
    return buf.includes(0) ? null : buf.toString('utf8');
  } catch {
    return null;
  }
}
