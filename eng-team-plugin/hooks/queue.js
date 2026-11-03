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
 * close entries whose effect this hook can verify itself, and
 * `node queue.js close <Q-n> --evidence "<what shows it is done>"` to close one
 * it has checked itself (recorded as `by: agent-evidence`). Neither closes an
 * entry flagged needs_human_test. Zero dependencies, Node 18+.
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
function mark(root, id, status, now = Date.now(), by = 'human', extra = {}) {
  if (!['done', 'rejected', 'approved'].includes(status)) return false;
  const e = entries(root, now).find((x) => x.id === id);
  if (!e || !['pending', 'expired'].includes(e.status)) return false;
  if (status === 'approved' && by !== 'human') return false;
  append(root, { id, status, [`${status === 'rejected' ? 'rejected' : status === 'done' ? 'done' : 'approved'}_at`]: new Date(now).toISOString(), by, ...extra });
  return true;
}

/** How long an approval lets Claude run the entry's exact command (once). */
const APPROVAL_WINDOW_MS = 60 * 60 * 1000;

/**
 * The human approved this exact command in this directory within the last
 * hour: mark the entry used (`done`, `by: approved-run`) and return its id.
 * Single use: a second run of the same command is queued again.
 * @returns {string|null}
 */
function useApproval(root, command, cwd, now = Date.now()) {
  const hash = hashOf(command, cwd || root);
  const e = entries(root, now).find(
    (x) => x.status === 'approved' && x.hash === hash && now - Date.parse(x.approved_at) <= APPROVAL_WINDOW_MS
  );
  if (!e) return null;
  append(root, { id: e.id, status: 'done', done_at: new Date(now).toISOString(), by: 'approved-run' });
  return e.id;
}

const humanOnly = (root, e) => e.needs_human_test || (e.needs_human_test === undefined && needsHumanTest(root, e.command || ''));

/**
 * The orchestrator closes one entry it has checked itself, with the evidence
 * recorded. Never an entry that needs a human test (prod, deploy, migrations,
 * human_required_paths): only the user closes those.
 * @returns {{ok: boolean, why?: string}}
 */
function closeWithEvidence(root, id, evidence, now = Date.now()) {
  const ev = String(evidence || '').replace(/\s+/g, ' ').trim();
  if (ev.length < 10 || ev.length > 300) return { ok: false, why: 'evidence must be 10-300 characters saying what shows it is done' };
  const e = entries(root, now).find((x) => x.id === id);
  if (!e) return { ok: false, why: `no entry ${id}` };
  if (!['pending', 'expired'].includes(e.status)) return { ok: false, why: `${id} is already ${e.status}` };
  if (humanOnly(root, e)) return { ok: false, why: `${id} needs a human test; only the user closes it` };
  return mark(root, id, 'done', now, 'agent-evidence', { evidence: ev }) ? { ok: true } : { ok: false, why: 'could not record it' };
}

const MAX_BATCH = 20;

/**
 * Strict parse of `/eng-queue` arguments: one verb, then 1-20 ids separated
 * by spaces, commas, `&` or `and`. Anything else parses to null and records nothing.
 * @returns {{status: 'done'|'rejected', ids: string[]}|null}
 */
const normId = (id) => `Q-${String(Number(id.slice(2))).padStart(3, '0')}`;
const VERB = (v) => (/^reject/i.test(v) ? 'rejected' : /^approve/i.test(v) ? 'approved' : 'done');
const IDS = 'Q-\\d{1,6}(?:(?:\\s*[,&]\\s*|\\s+and\\s+|\\s+)Q-\\d{1,6}){0,19}';

function parseMark(args) {
  const m = new RegExp(`^\\s*(done|reject(?:ed)?|approve)\\s+(${IDS})\\s*$`, 'i').exec(String(args));
  if (!m) return null;
  const ids = [...new Set(m[2].toUpperCase().match(/Q-\d{1,6}/g).map(normId))];
  return ids.length <= MAX_BATCH ? { status: VERB(m[1]), ids } : null;
}

/**
 * `approve Q-3` or `reject Q-3 and Q-4` inside a message the human typed.
 * @returns {{status: 'approved'|'rejected', ids: string[]}[]}
 */
function parseChat(text) {
  const out = [];
  for (const m of String(text).slice(0, 4000).matchAll(new RegExp(`(?:^|[\\s,.;:!(])(approve|reject)\\s+(${IDS})(?![\\w-])`, 'gi'))) {
    const ids = [...new Set(m[2].toUpperCase().match(/Q-\d{1,6}/g).map(normId))];
    if (ids.length <= MAX_BATCH) out.push({ status: VERB(m[1]), ids });
  }
  return out;
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
    if (by === 'agent-verified' && humanOnly(root, e)) continue;
    if ((verifiedGone(root, e) || branchGone(e.command, e.cwd) || worktreesGone(e)) && mark(root, e.id, 'done', now, by)) out.push(e.id);
  }
  return out;
}

module.exports = { QUEUE_FILE, entries, enqueue, mark, parseMark, parseChat, useApproval, APPROVAL_WINDOW_MS, reconcile, closeWithEvidence, hashOf, needsHumanTest };

// `node queue.js close [project dir]`: the orchestrator closes what the hook can verify.
// `node queue.js close <Q-n> --evidence "<text>"`: it closes one entry it checked itself.
if (require.main === module) {
  const args = process.argv.slice(2);
  const usage = 'usage: node queue.js close [project dir] | node queue.js close <Q-n> --evidence "<what shows it is done>"';
  if (args[0] !== 'close') {
    console.error(usage);
    process.exit(2);
  }
  if (/^Q-\d{1,6}$/.test(args[1] || '')) {
    const i = args.indexOf('--evidence');
    if (i < 0 || args.length !== 4 || i !== 2) {
      console.error(usage);
      process.exit(2);
    }
    const root = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
    const r = closeWithEvidence(root, args[1], args[3]);
    console.log(r.ok ? `Closed ${args[1]} (agent-evidence).` : `Not closed: ${r.why}`);
    process.exit(r.ok ? 0 : 1);
  }
  const dir = args[1];
  const root = path.resolve(dir || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const closed = reconcile(root, Date.now(), 'agent-verified');
  const open = entries(root).filter((e) => e.status === 'pending');
  console.log(closed.length ? `Closed (verified): ${closed.join(', ')}` : 'Nothing could be verified as done.');
  for (const e of open) console.log(`Still open: ${e.id}${e.needs_human_test ? ' (needs human test)' : ''} — ${e.command}`);
}
