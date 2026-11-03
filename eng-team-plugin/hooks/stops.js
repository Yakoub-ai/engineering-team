'use strict';
/**
 * eng-team guard stops: a guard denial the lead may not resume on its own.
 *
 * The guard records every subagent denial it does not queue in
 * `.eng-team/approvals/stops.jsonl` (only hooks write there; the guard denies
 * Claude's writes to .eng-team/approvals/). While a stop is open, the dispatch
 * hook refuses new builder, tester and tech-writer dispatches; read-only
 * reviewers still run and agents already running finish. The next message the
 * human types (UserPromptSubmit, which never fires for tool output or agent
 * reports) answers every open stop. Zero dependencies, Node 18+.
 */
const fs = require('node:fs');
const path = require('node:path');

const STOPS_FILE = path.join('.eng-team', 'approvals', 'stops.jsonl');
const PAUSED_ROLES = new Set(['eng-builder', 'eng-tester', 'eng-tech-writer']);

/** @returns {object[]} latest state per id, oldest first */
function stops(root) {
  let text = '';
  try {
    text = fs.readFileSync(path.join(root, STOPS_FILE), 'utf8');
  } catch {
    return [];
  }
  const byId = new Map();
  for (const line of text.split('\n')) {
    try {
      const e = JSON.parse(line);
      if (e && typeof e.id === 'string') byId.set(e.id, { ...byId.get(e.id), ...e });
    } catch {
      /* skip */
    }
  }
  return [...byId.values()];
}

const openStops = (root) => stops(root).filter((e) => e.status === 'open');

function append(root, entry) {
  const f = path.join(root, STOPS_FILE);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.appendFileSync(f, JSON.stringify(entry) + '\n');
}

/**
 * Record a guard denial of a subagent call.
 * @param {string} root project root
 * @param {{agent: string, agentId?: string, tool: string, what: string, reason: string}} d
 * @returns {string} stop id
 */
function recordStop(root, { agent, agentId, tool, what, reason }, now = Date.now()) {
  const n = stops(root).length + 1;
  const id = `S-${n}`;
  append(root, {
    id,
    created: new Date(now).toISOString(),
    status: 'open',
    agent,
    ...(agentId ? { agent_id: agentId } : {}),
    tool,
    what: String(what).slice(0, 2000),
    reason: String(reason).slice(0, 500),
  });
  return id;
}

/** The human typed a message: every open stop is answered. @returns {string[]} ids */
function answerAll(root, now = Date.now()) {
  const ids = openStops(root).map((e) => e.id);
  for (const id of ids) append(root, { id, status: 'answered', answered: new Date(now).toISOString() });
  return ids;
}

/**
 * Why an eng-team dispatch must wait for the human, or null.
 * @param {string} role subagent type without the `eng-team:` prefix
 * @param {string} root project root
 * @returns {string|null}
 */
function pausedFor(role, root) {
  if (!PAUSED_ROLES.has(role)) return null;
  const open = openStops(root);
  if (!open.length) return null;
  const list = open.map((e) => `${e.id} (${e.agent}: ${e.what.slice(0, 160)})`).join('; ');
  return (
    `eng-team stop: guard stop ${list} is open, so ${role} may not be dispatched until the human answers. ` +
    'Follow the Hard-stop procedure: quote the exact denied command and the guard reason, say if it looks like a false positive, and end your turn. ' +
    'Read-only reviewers may still run. Do not re-dispatch under another task id.'
  );
}

module.exports = { STOPS_FILE, stops, openStops, recordStop, answerAll, pausedFor };
