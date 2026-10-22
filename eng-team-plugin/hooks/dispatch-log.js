'use strict';
/**
 * eng-team dispatch log.
 *
 * Appends one JSON line per eng-team subagent dispatch and return to
 * `.eng-team/.cache/dispatch-log.jsonl`, written by the hook so it costs the
 * lead no tokens and the timestamps are real. Records metadata only (agent,
 * model, time, terminal status), never prompts or agent output. Observation
 * only: it never blocks, never creates `.eng-team/`, and silently does nothing
 * on any error. Zero dependencies, Node 18+.
 */
const fs = require('node:fs');
const path = require('node:path');

const PREFIX = 'eng-team:';
const MAX_BYTES = 1024 * 1024;
const DISPATCH_TOOLS = new Set(['Agent', 'Task']);

/**
 * Turn a hook payload into a log entry.
 * @param {object} input parsed hook stdin
 * @param {Date} [now]
 * @returns {object|null} null = not an eng-team event
 */
function entryFor(input, now = new Date()) {
  if (!input || typeof input !== 'object') return null;
  const ts = now.toISOString();
  if (input.hook_event_name === 'SubagentStop' || (input.agent_type && !input.tool_name)) {
    const agent = input.agent_type;
    if (typeof agent !== 'string' || !agent.startsWith(PREFIX)) return null;
    const msg = typeof input.last_assistant_message === 'string' ? input.last_assistant_message : '';
    const status = /^HARD-STOP:/m.test(msg) ? 'HARD-STOP' : (/^Status:\s*(DONE|BLOCKED|HARD-STOP)\b/m.exec(msg) || [])[1];
    return { ts, event: 'return', agent: agent.slice(PREFIX.length), ...(status ? { status } : {}) };
  }
  if (!DISPATCH_TOOLS.has(input.tool_name)) return null;
  const ti = input.tool_input || {};
  const type = ti.subagent_type;
  if (typeof type !== 'string' || !type.startsWith(PREFIX)) return null;
  return { ts, event: 'dispatch', agent: type.slice(PREFIX.length), model: typeof ti.model === 'string' ? ti.model : 'default' };
}

/**
 * Append the entry for a payload when the project is an eng-team project.
 * @param {object} input parsed hook stdin
 * @param {{projectDir?: string, now?: Date}} [opts]
 * @returns {boolean} true when a line was written
 */
function record(input, { projectDir, now } = {}) {
  const entry = entryFor(input, now);
  if (!entry) return false;
  const root = projectDir || input.cwd || process.cwd();
  if (!fs.existsSync(path.join(root, '.eng-team', 'state.md'))) return false;
  const dir = path.join(root, '.eng-team', '.cache');
  const file = path.join(dir, 'dispatch-log.jsonl');
  fs.mkdirSync(dir, { recursive: true });
  try {
    if (fs.statSync(file).size > MAX_BYTES) return false;
  } catch {
    // no log yet
  }
  fs.appendFileSync(file, JSON.stringify(entry) + '\n');
  return true;
}

module.exports = { entryFor, record };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);
      record(input, { projectDir: process.env.CLAUDE_PROJECT_DIR || input.cwd });
    } catch {
      // observation only: never wedge the session
    }
  });
}
