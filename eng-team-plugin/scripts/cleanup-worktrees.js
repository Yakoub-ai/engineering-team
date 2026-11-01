#!/usr/bin/env node
'use strict';
/**
 * Remove eng-team agent worktrees and their branches once nothing can be lost.
 * Claude may run this (the guard protects the plugin, so it cannot be edited);
 * every check is done here, not by Claude. A worktree is removed only when:
 *   - it lives under <repo>/.claude/worktrees/ and is on a worktree-agent-* branch
 *   - nothing in it changed in the last 30 minutes (a running agent is left alone)
 *   - every commit on its branch is kept elsewhere (gitref.branchSafe, patch-ids)
 * Uncommitted or untracked leftovers (anything but regenerable paths such as
 * node_modules, dist, caches) are copied to the recoverable trash first
 * (scripts/trash.js, kept 14 days), so removing the worktree loses nothing.
 * Usage: node cleanup-worktrees.js [--dry-run] [repo dir]
 */
const fs = require('node:fs');
const path = require('node:path');
const { git, branchSafe } = require('../hooks/gitref.js');
const { execFileSync } = require('node:child_process');
const { keepCopies } = require('./trash.js');

const REGEN = new Set([
  'node_modules', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.turbo', '.parcel-cache', '.cache',
  'coverage', '.nyc_output', 'target', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox',
  '.venv', 'venv', 'tmp', '.tmp', '.gradle',
]);
const BRANCH = /^worktree-agent-[\w.-]{1,100}$/;
const QUIET_MS = 30 * 60 * 1000;

/** @returns {{path: string, branch: string|null, locked: boolean}[]} */
function worktrees(cwd) {
  const r = git(cwd, ['worktree', 'list', '--porcelain']);
  if (r.code !== 0) return [];
  return r.out.split(/\n\n+/).map((block) => {
    const lines = block.split('\n');
    const get = (k) => lines.find((l) => l === k || l.startsWith(k + ' '));
    const b = get('branch');
    return {
      path: (get('worktree') || '').slice('worktree '.length),
      branch: b ? b.slice('branch '.length).replace(/^refs\/heads\//, '') : null,
      locked: !!get('locked'),
    };
  });
}

/** `git status -z` untrimmed (a leading space is part of the status code). */
function statusZ(cwd) {
  try {
    const out = execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignored=traditional'], {
      cwd, encoding: 'utf8', timeout: 10000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
    });
    return { code: 0, out };
  } catch {
    return { code: 1, out: '' };
  }
}

const regenerable = (file) => file.split('/').some((seg) => REGEN.has(seg));

/** @returns {{why: string|null, leftovers?: string[]}|null} why this worktree must stay, or the leftovers to keep copies of */
function keepReason(wt, base, main, now) {
  let real;
  try {
    real = fs.realpathSync(wt.path);
  } catch {
    return null; // already gone from disk: prune handles it
  }
  if (!real.startsWith(base + path.sep)) return { why: 'not under .claude/worktrees/' };
  if (!wt.branch || !BRANCH.test(wt.branch)) return { why: 'not on a worktree-agent-* branch' };
  const gd = git(real, ['rev-parse', '--absolute-git-dir']);
  const newest = [real, ...(gd.code === 0 ? ['index', 'HEAD', 'logs/HEAD'].map((f) => path.join(gd.out, f)) : [])].reduce((m, f) => {
    try {
      return Math.max(m, fs.statSync(f).mtimeMs);
    } catch {
      return m;
    }
  }, 0);
  if (now - newest < QUIET_MS) return { why: 'changed in the last 30 minutes (agent may still be running)' };
  if (!branchSafe(main, wt.branch)) return { why: 'has commits not on another branch or on the default/current branch' };
  const st = statusZ(real);
  if (st.code !== 0) return { why: 'git status failed' };
  const leftovers = [];
  const recs = st.out.split('\0');
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    if (rec.length < 4) continue;
    const code = rec.slice(0, 2);
    const file = rec.slice(3);
    if (code[0] === 'R' || code[0] === 'C') i++; // -z puts the rename source in the next record
    if ((code === '!!' || code === '??') && regenerable(file)) continue;
    if (code.includes('D') && !code.includes('?')) continue; // deleted: the committed copy is kept
    leftovers.push(file.replace(/\/$/, ''));
  }
  return { why: null, leftovers };
}

/** @returns {{removed: string[], kept: {path: string, why: string}[], trashed: {path: string, run: string}[]}} */
function cleanup(cwd, { dryRun = false, now = Date.now() } = {}) {
  const all = worktrees(cwd);
  if (!all.length) return { removed: [], kept: [], trashed: [] };
  const main = all[0].path;
  let base;
  try {
    base = fs.realpathSync(path.join(main, '.claude', 'worktrees'));
  } catch {
    return { removed: [], kept: [], trashed: [] };
  }
  const removed = [];
  const kept = [];
  const trashed = [];
  for (const wt of all.slice(1)) {
    if (!wt.path.startsWith(path.join(main, '.claude', 'worktrees') + path.sep) && !wt.path.startsWith(base + path.sep)) continue;
    const r = keepReason(wt, base, main, now);
    if (r && r.why) {
      kept.push({ path: wt.path, why: r.why });
      continue;
    }
    const leftovers = (r && r.leftovers) || [];
    if (dryRun) {
      removed.push(wt.path);
      if (leftovers.length) trashed.push({ path: wt.path, run: `(dry run) ${leftovers.length} leftover path(s)` });
      continue;
    }
    if (leftovers.length) {
      let run = null;
      try {
        run = keepCopies(fs.realpathSync(main), fs.realpathSync(wt.path), leftovers, `leftovers of ${wt.branch}`);
      } catch (e) {
        kept.push({ path: wt.path, why: `could not copy leftovers to the trash (${String(e && e.message).slice(0, 80)})` });
        continue;
      }
      if (run) trashed.push({ path: wt.path, run });
    }
    if (wt.locked) git(main, ['worktree', 'unlock', wt.path]);
    if (git(main, ['worktree', 'remove', '--force', wt.path]).code !== 0) {
      kept.push({ path: wt.path, why: 'git worktree remove failed' });
      continue;
    }
    if (wt.branch && branchSafe(main, wt.branch)) git(main, ['branch', '-D', wt.branch]);
    removed.push(wt.path);
  }
  if (!dryRun) git(main, ['worktree', 'prune']);
  return { removed, kept, trashed };
}

module.exports = { cleanup };

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dir = args.find((a) => !a.startsWith('--')) || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const { removed, kept, trashed } = cleanup(path.resolve(dir), { dryRun });
  console.log(`${dryRun ? 'Would remove' : 'Removed'} ${removed.length} agent worktree(s)${removed.length ? ':' : '.'}`);
  for (const p of removed) console.log(`  ${p}`);
  if (kept.length) console.log(`Kept ${kept.length}:`);
  for (const k of kept) console.log(`  ${k.path} — ${k.why}`);
  for (const t of trashed) console.log(`Leftovers of ${t.path} copied to the trash: ${t.run} (kept 14 days; restore with node trash.js --restore <run>)`);
}
