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
 * Claude run the command. Zero dependencies, Node 18+.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { readPolicy } = require('./policy.js');
const { branchGone } = require('./gitref.js');

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
    reason, requested_by: agent || 'main', hash,
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

/**
 * Mark pending or expired entries done when their effect is already on disk.
 * The hook decides from the filesystem or git, never Claude; only `rm` and plain
 * single-branch `git branch -d|-D` are understood.
 * @returns {string[]} ids closed
 */
function reconcile(root, now = Date.now()) {
  const out = [];
  for (const e of entries(root, now))
    if (['pending', 'expired'].includes(e.status) && (verifiedGone(root, e) || branchGone(e.command, e.cwd)) && mark(root, e.id, 'done', now, 'hook-verified')) out.push(e.id);
  return out;
}

module.exports = { QUEUE_FILE, entries, enqueue, mark, parseMark, reconcile, hashOf };
