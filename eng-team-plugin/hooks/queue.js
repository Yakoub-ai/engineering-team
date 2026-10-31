'use strict';
/**
 * eng-team approval queue, v1: the human executes.
 *
 * When the guard denies a destructive command it records the exact command
 * here, so the work that needs it can pause while everything else continues.
 * Only hooks write this file (the guard denies Claude's writes to
 * .eng-team/approvals/); the human marks entries with
 * `/eng-team:eng-queue done|reject <id>`, recorded by the UserPromptExpansion
 * hook, which fires only on commands the human types. No entry ever lets
 * Claude run the command. The orchestrator may run `node queue.js close` to
 * close entries whose effect this hook can verify itself, except entries
 * flagged needs_human_test. Zero dependencies, Node 18+.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { readPolicy } = require('./policy.js');
const { git, branchGone } = require('./gitref.js');

const QUEUE_FILE = path.join('.eng-team', 'approvals', 'queue.jsonl');

/** @returns {object[]} entries, oldest first; unreadable lines are skipped */
function readQueue(root) {
  let text = '';
  try {
    text = fs.readFileSync(path.join(root, QUEUE_FILE), 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e && typeof e.id === 'string') out.push(e);
    } catch {
      /* skip */
    }
  }
  return out;
}

/** Latest state per id (later lines are status updates). */
function entries(root, now = Date.now()) {
  const byId = new Map();
  for (const e of readQueue(root)) byId.set(e.id, { ...byId.get(e.id), ...e });
  const ttl = readPolicy(root).policy.approval_ttl_hours * 3600 * 1000;
  return [...byId.values()].map((e) =>
    e.status === 'pending' && now - Date.parse(e.created) > ttl ? { ...e, status: 'expired' } : e
  );
}

const hashOf = (command, cwd) => crypto.createHash('sha256').update(`${cwd}\n${command}`).digest('hex');

function append(root, entry) {
  const f = path.join(root, QUEUE_FILE);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.appendFileSync(f, JSON.stringify(entry) + '\n');
}

const HUMAN_TEST = /\b(?:prod|production|prd|live|deploy\w*|release|migrat\w*|rollback)\b/i;

/** Entries only a human may close: prod, deploy, migrations, or the policy's human_required_paths. */
function needsHumanTest(root, command) {
  if (HUMAN_TEST.test(command)) return true;
  return readPolicy(root).policy.human_required_paths.some((g) => {
    const lit = g.split('*')[0].replace(/\/+$/, '');
    return lit.length > 1 && command.includes(lit);
  });
}

/**
 * Queue a denied destructive command, or return the pending entry that
 * already holds the same command and directory.
 * @returns {string} entry id
 */
function enqueue(root, { command, cwd, reason, agent }, now = Date.now()) {
  const hash = hashOf(command, cwd || root);
  const all = entries(root, now);
  const same = all.find((e) => e.status === 'pending' && e.hash === hash);
  if (same) return same.id;
  const n = all.reduce((m, e) => Math.max(m, Number(/^Q-(\d+)$/.exec(e.id)?.[1] || 0)), 0) + 1;
  const id = `Q-${String(n).padStart(3, '0')}`;
  append(root, {
    id, status: 'pending', created: new Date(now).toISOString(), command, cwd: cwd || root,
    reason, requested_by: agent || 'main', hash, needs_human_test: needsHumanTest(root, command),
  });
  return id;
}

/**
 * Human-typed status change. Only pending or expired entries change.
 * @returns {boolean}
 */
function mark(root, id, status, now = Date.now(), by = 'human') {
  if (!['done', 'rejected'].includes(status)) return false;
  const e = entries(root, now).find((x) => x.id === id);
  if (!e || !['pending', 'expired'].includes(e.status)) return false;
  append(root, { id, status, [status === 'done' ? 'done_at' : 'rejected_at']: new Date(now).toISOString(), by });
  return true;
}

const MAX_BATCH = 20;

/**
 * Strict parse of `/eng-queue` arguments: one verb, then 1-20 ids separated
 * by spaces, commas, `&` or `and`. Anything else parses to null and records nothing.
 * @returns {{status: 'done'|'rejected', ids: string[]}|null}
 */
function parseMark(args) {
  const m = /^\s*(done|reject(?:ed)?)\s+(Q-\d{1,6}(?:(?:\s*[,&]\s*|\s+and\s+|\s+)Q-\d{1,6}){0,19})\s*$/i.exec(String(args));
  if (!m) return null;
  const ids = [...new Set(m[2].toUpperCase().match(/Q-\d{1,6}/g))];
  return ids.length <= MAX_BATCH ? { status: m[1].toLowerCase().startsWith('reject') ? 'rejected' : 'done', ids } : null;
}

/**
 * True only when the queued command is a plain `rm` of literal paths inside
 * the project and every one of them is already gone (a read-only check).
 * Globs, variables, quoting, chaining and anything but ENOENT mean "not verified".
 */
function verifiedGone(root, e) {
  const m = /^rm((?:\s+-[rRfv]+)*)((?:\s+[\w@%+=:,./-]+)+)$/.exec(String(e.command || '').trim());
  if (!m) return false;
  const paths = m[2].trim().split(/\s+/);
  if (paths.some((t) => t.startsWith('-') || t === '.' || t === '..')) return false;
  let base;
  try {
    base = fs.realpathSync(root);
    if (!fs.statSync(e.cwd).isDirectory()) return false;
  } catch {
    return false;
  }
  return paths.every((t) => {
    const abs = path.resolve(e.cwd, t);
    if (abs === base || !abs.startsWith(base + path.sep)) return false;
    try {
      fs.lstatSync(abs);
      return false;
    } catch (err) {
      return err.code === 'ENOENT';
    }
  });
}

/** A cleanup of agent worktrees/branches is done when none are left (git answers, not Claude). */
function worktreesGone(e) {
  if (!/worktree-agent-|\.claude\/worktrees/.test(String(e.command || ''))) return false;
  const wl = git(e.cwd, ['worktree', 'list', '--porcelain']);
  const br = git(e.cwd, ['for-each-ref', '--format=%(refname)', 'refs/heads/worktree-agent-*']);
  if (wl.code !== 0 || br.code !== 0) return false;
  return !/^worktree .*\/\.claude\/worktrees\//m.test(wl.out) && br.out === '';
}

/**
 * Mark pending or expired entries done when their effect is already there.
 * The hook decides from the filesystem or git, never Claude; only `rm`, plain
 * single-branch `git branch -d|-D` and agent-worktree cleanup are understood.
 * `by: 'agent-verified'` (the orchestrator's `close`) skips needs_human_test entries.
 * @returns {string[]} ids closed
 */
function reconcile(root, now = Date.now(), by = 'hook-verified') {
  const out = [];
  for (const e of entries(root, now)) {
    if (!['pending', 'expired'].includes(e.status)) continue;
    if (by === 'agent-verified' && (e.needs_human_test || e.needs_human_test === undefined && needsHumanTest(root, e.command || ''))) continue;
    if ((verifiedGone(root, e) || branchGone(e.command, e.cwd) || worktreesGone(e)) && mark(root, e.id, 'done', now, by)) out.push(e.id);
  }
  return out;
}

module.exports = { QUEUE_FILE, entries, enqueue, mark, parseMark, reconcile, hashOf, needsHumanTest };

// `node queue.js close [project dir]`: the orchestrator closes what the hook can verify.
if (require.main === module) {
  const [verb, dir] = process.argv.slice(2);
  if (verb !== 'close') {
    console.error('usage: node queue.js close [project dir]');
    process.exit(2);
  }
  const root = path.resolve(dir || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const closed = reconcile(root, Date.now(), 'agent-verified');
  const open = entries(root).filter((e) => e.status === 'pending');
  console.log(closed.length ? `Closed (verified): ${closed.join(', ')}` : 'Nothing could be verified as done.');
  for (const e of open) console.log(`Still open: ${e.id}${e.needs_human_test ? ' (needs human test)' : ''} — ${e.command}`);
}
