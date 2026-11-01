#!/usr/bin/env node
'use strict';
/**
 * Remove eng-team agent worktrees and their branches once nothing can be lost.
 * Claude may run this (the guard protects the plugin, so it cannot be edited);
 * every check is done here, not by Claude. A worktree is removed only when:
 *   - it lives under <repo>/.claude/worktrees/ and is on a worktree-agent-* branch
 *   - it has no changes except regenerable paths (node_modules, dist, caches …)
 *   - nothing in it changed in the last 30 minutes (a running agent is left alone)
 *   - every commit on its branch is kept elsewhere (gitref.branchSafe, patch-ids)
 * Usage: node cleanup-worktrees.js [--dry-run] [repo dir]
 */
const fs = require('node:fs');
const path = require('node:path');
const { git, branchSafe } = require('../hooks/gitref.js');

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

/** @returns {string|null} why this worktree must stay */
function keepReason(wt, base, main, now) {
  let real;
  try {
    real = fs.realpathSync(wt.path);
  } catch {
    return null; // already gone from disk: prune handles it
  }
  if (!real.startsWith(base + path.sep)) return 'not under .claude/worktrees/';
  if (!wt.branch || !BRANCH.test(wt.branch)) return 'not on a worktree-agent-* branch';
  const st = git(real, ['status', '--porcelain=v1', '--untracked-files=normal', '--ignored=traditional']);
  if (st.code !== 0) return 'git status failed';
  for (const line of st.out.split('\n').filter(Boolean)) {
    const top = line.slice(3).replace(/^"|"$/g, '').split('/')[0];
    if (!/^(?:\?\?|!!) /.test(line) || !REGEN.has(top)) return `uncommitted or untracked: ${line.slice(3)}`;
  }
  const gd = git(real, ['rev-parse', '--absolute-git-dir']);
  const newest = [real, ...(gd.code === 0 ? ['index', 'HEAD', 'logs/HEAD'].map((f) => path.join(gd.out, f)) : [])].reduce((m, f) => {
    try {
      return Math.max(m, fs.statSync(f).mtimeMs);
    } catch {
      return m;
    }
  }, 0);
  if (now - newest < QUIET_MS) return 'changed in the last 30 minutes (agent may still be running)';
  if (!branchSafe(main, wt.branch)) return 'has commits not on another branch or on the default/current branch';
  return null;
}

/** @returns {{removed: string[], kept: {path: string, why: string}[]}} */
function cleanup(cwd, { dryRun = false, now = Date.now() } = {}) {
  const all = worktrees(cwd);
  if (!all.length) return { removed: [], kept: [] };
  const main = all[0].path;
  let base;
  try {
    base = fs.realpathSync(path.join(main, '.claude', 'worktrees'));
  } catch {
    return { removed: [], kept: [] };
  }
  const removed = [];
  const kept = [];
  for (const wt of all.slice(1)) {
    if (!wt.path.startsWith(path.join(main, '.claude', 'worktrees') + path.sep) && !wt.path.startsWith(base + path.sep)) continue;
    const why = keepReason(wt, base, main, now);
    if (why) {
      kept.push({ path: wt.path, why });
      continue;
    }
    if (dryRun) {
      removed.push(wt.path);
      continue;
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
  return { removed, kept };
}

module.exports = { cleanup };

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dir = args.find((a) => !a.startsWith('--')) || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const { removed, kept } = cleanup(path.resolve(dir), { dryRun });
  console.log(`${dryRun ? 'Would remove' : 'Removed'} ${removed.length} agent worktree(s)${removed.length ? ':' : '.'}`);
  for (const p of removed) console.log(`  ${p}`);
  if (kept.length) console.log(`Kept ${kept.length}:`);
  for (const k of kept) console.log(`  ${k.path} — ${k.why}`);
}
