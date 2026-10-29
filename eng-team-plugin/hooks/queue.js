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
function mark(root, id, status, now = Date.now()) {
  if (!['done', 'rejected'].includes(status)) return false;
  const e = entries(root, now).find((x) => x.id === id);
  if (!e || !['pending', 'expired'].includes(e.status)) return false;
  append(root, { id, status, [status === 'done' ? 'done_at' : 'rejected_at']: new Date(now).toISOString(), by: 'human' });
  return true;
}

module.exports = { QUEUE_FILE, entries, enqueue, mark, hashOf };
