#!/usr/bin/env node
'use strict';
/**
 * Recoverable delete for the eng-team lead. Moves paths inside the project to
 * ~/.eng-team/trash/<project>/<run>/ (outside the repo), keeps each run 14
 * days, and can put a run back. Every check is done here, not by Claude; the
 * guard protects the plugin and ~/.eng-team, so neither can be edited.
 * Usage:
 *   node trash.js [--dry-run] <path>...   move paths inside the project to the trash
 *   node trash.js --list                  list this project's trash runs
 *   node trash.js --restore <run>         put a run back (never overwrites)
 * Zero dependencies, Node 18+.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { engHome } = require('../hooks/policy.js');
const { git } = require('../hooks/gitref.js');

const KEEP_MS = 14 * 24 * 3600 * 1000;
const RUN_RE = /^\d{8}T\d{6}Z-[0-9a-f]{6}$/;
const REFUSED_TOP = new Set(['.git', '.eng-team']);
const PROTECTED = new Set(['.claude/settings.json', '.claude/settings.local.json']);

/** Project root: the git top level of `dir` (realpath), or `dir` itself. */
function projectRoot(dir) {
  const r = git(dir, ['rev-parse', '--show-toplevel']);
  return fs.realpathSync(r.code === 0 && r.out ? r.out : dir);
}

const projectTrash = (root) =>
  path.join(engHome(), 'trash', `${path.basename(root).replace(/[^\w.-]/g, '_')}-${crypto.createHash('sha256').update(root).digest('hex').slice(0, 12)}`);

const mkdirPrivate = (d) => fs.mkdirSync(d, { recursive: true, mode: 0o700 });

/** Move, or copy then remove across devices. Symlinks move as links. */
function move(src, dst) {
  mkdirPrivate(path.dirname(dst));
  try {
    fs.renameSync(src, dst);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    fs.cpSync(src, dst, { recursive: true, verbatimSymlinks: true, errorOnExist: true, force: false });
    fs.rmSync(src, { recursive: true, force: true });
  }
}

/**
 * @returns {{rel?: string, abs?: string, why?: string}} the checked path, or why it is refused
 */
function check(root, cwd, p) {
  if (typeof p !== 'string' || !p || p.includes('\0')) return { why: 'empty path' };
  const lexical = path.resolve(cwd, p);
  let abs;
  try {
    fs.lstatSync(lexical);
    // Resolve the parent only: a symlink is moved as a link, never followed.
    abs = path.join(fs.realpathSync(path.dirname(lexical)), path.basename(lexical));
  } catch {
    return { why: 'does not exist' };
  }
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return { why: 'outside the project, or the project itself' };
  const segs = rel.split(path.sep);
  if (REFUSED_TOP.has(segs[0])) return { why: `${segs[0]}/ is never trashed` };
  if (segs.includes('.git')) return { why: 'inside a .git directory' };
  if (segs[0] === '.claude' && segs[1] === 'worktrees') return { why: 'agent worktrees: use cleanup-worktrees.js' };
  if (PROTECTED.has(segs.join('/'))) return { why: 'protected settings file' };
  if (fs.lstatSync(abs).isDirectory() && fs.existsSync(path.join(abs, '.git'))) return { why: 'a git repository or worktree' };
  return { rel, abs };
}

function newRun(root, items, note) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const id = `${stamp}-${crypto.randomBytes(3).toString('hex')}`;
  const dir = path.join(projectTrash(root), id);
  mkdirPrivate(path.join(dir, 'files'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ project: root, created: new Date().toISOString(), note, items }, null, 2), { mode: 0o600 });
  return { id, dir };
}

function readManifest(dir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    return m && Array.isArray(m.items) ? m : null;
  } catch {
    return null;
  }
}

/** Runs of this project, oldest first. */
function runs(root) {
  const base = projectTrash(root);
  let names = [];
  try {
    names = fs.readdirSync(base).filter((n) => RUN_RE.test(n)).sort();
  } catch {
    return [];
  }
  return names.map((id) => ({ id, dir: path.join(base, id), manifest: readManifest(path.join(base, id)) })).filter((r) => r.manifest);
}

/** Remove this project's runs older than 14 days. @returns {string[]} run ids */
function purge(root, now = Date.now()) {
  const out = [];
  for (const r of runs(root)) {
    if (now - Date.parse(r.manifest.created) <= KEEP_MS) continue;
    fs.rmSync(r.dir, { recursive: true, force: true });
    out.push(r.id);
  }
  return out;
}

/**
 * Move paths inside the project to a new trash run. All paths are checked
 * first; if any is refused, nothing moves.
 * @returns {{run: string|null, moved: string[], refused: {path: string, why: string}[], purged: string[]}}
 */
function trash(root, cwd, paths, { dryRun = false, now = Date.now(), note = '' } = {}) {
  const ok = [];
  const refused = [];
  for (const p of paths) {
    const c = check(root, cwd, p);
    if (c.why) refused.push({ path: p, why: c.why });
    else if (!ok.some((x) => x.rel === c.rel)) ok.push(c);
  }
  // A path inside another listed path would move twice.
  for (const c of ok) if (ok.some((o) => o !== c && c.rel.startsWith(o.rel + path.sep))) refused.push({ path: c.rel, why: `inside ${c.rel.split(path.sep)[0]}, listed too` });
  if (refused.length || dryRun || !ok.length) return { run: null, moved: refused.length ? [] : ok.map((c) => c.rel), refused, purged: [] };
  const purged = purge(root, now);
  const { id, dir } = newRun(root, ok.map((c) => c.rel), note);
  for (const c of ok) move(c.abs, path.join(dir, 'files', c.rel));
  return { run: id, moved: ok.map((c) => c.rel), refused, purged };
}

/**
 * Copy (not move) files of a worktree that is about to be removed, so leftovers
 * survive. `rels` are relative to the worktree; stored under its project path.
 * @returns {string|null} run id
 */
function keepCopies(root, wtPath, rels, note) {
  const items = [];
  for (const r of rels) {
    const src = path.join(wtPath, r);
    try {
      fs.lstatSync(src);
    } catch {
      continue;
    }
    items.push(path.relative(root, src));
  }
  if (!items.length) return null;
  const { id, dir } = newRun(root, items, note);
  for (const rel of items) {
    const dst = path.join(dir, 'files', rel);
    mkdirPrivate(path.dirname(dst));
    fs.cpSync(path.join(root, rel), dst, { recursive: true, verbatimSymlinks: true });
  }
  return id;
}

/** Put a run back. Refuses the whole run if any target exists. */
function restore(root, id) {
  if (!RUN_RE.test(String(id))) return { ok: false, why: 'unknown run id' };
  const r = runs(root).find((x) => x.id === id);
  if (!r) return { ok: false, why: 'no such run for this project' };
  const clash = r.manifest.items.filter((rel) => fs.existsSync(path.join(root, rel)));
  if (clash.length) return { ok: false, why: `would overwrite: ${clash.join(', ')}` };
  for (const rel of r.manifest.items) {
    const src = path.join(r.dir, 'files', rel);
    if (fs.existsSync(src)) move(src, path.join(root, rel));
  }
  fs.rmSync(r.dir, { recursive: true, force: true });
  return { ok: true, items: r.manifest.items };
}

module.exports = { trash, keepCopies, restore, runs, purge, projectRoot, projectTrash, KEEP_MS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const root = projectRoot(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (args[0] === '--list') {
    const all = runs(root);
    if (!all.length) console.log('Trash is empty for this project.');
    for (const r of all) console.log(`${r.id}  ${r.manifest.items.length} item(s)  ${r.manifest.items.slice(0, 5).join(', ')}${r.manifest.items.length > 5 ? ', …' : ''}`);
    process.exit(0);
  }
  if (args[0] === '--restore') {
    const r = restore(root, args[1]);
    console.log(r.ok ? `Restored ${r.items.length} item(s): ${r.items.join(', ')}` : `Not restored: ${r.why}`);
    process.exit(r.ok ? 0 : 1);
  }
  const dryRun = args.includes('--dry-run');
  const paths = args.filter((a) => a !== '--dry-run');
  if (!paths.length) {
    console.error('usage: node trash.js [--dry-run] <path>... | --list | --restore <run>');
    process.exit(2);
  }
  const res = trash(root, process.cwd(), paths, { dryRun });
  if (res.refused.length) {
    console.log('Nothing moved. Refused:');
    for (const x of res.refused) console.log(`  ${x.path} — ${x.why}`);
    process.exit(1);
  }
  console.log(`${dryRun ? 'Would move' : 'Moved'} ${res.moved.length} path(s) to the trash${res.run ? ` (run ${res.run}, kept 14 days; restore with --restore ${res.run})` : ''}:`);
  for (const p of res.moved) console.log(`  ${p}`);
  if (res.purged.length) console.log(`Purged ${res.purged.length} run(s) older than 14 days.`);
}
