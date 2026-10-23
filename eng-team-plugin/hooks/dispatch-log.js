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
const TASK_RE = /^Task:[ \t]*([A-Za-z0-9._-]{1,40})[ \t]*$/m;
const ID_RE = /^[A-Za-z0-9._:-]{1,64}$/;

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
    const id = typeof input.agent_id === 'string' && ID_RE.test(input.agent_id) ? input.agent_id : null;
    return { ts, event: 'return', agent: agent.slice(PREFIX.length), ...(id ? { agent_id: id } : {}), ...(status ? { status } : {}) };
  }
  if (!DISPATCH_TOOLS.has(input.tool_name)) return null;
  const ti = input.tool_input || {};
  const type = ti.subagent_type;
  if (typeof type !== 'string' || !type.startsWith(PREFIX)) return null;
  const task = typeof ti.prompt === 'string' ? (TASK_RE.exec(ti.prompt) || [])[1] : undefined;
  return { ts, event: 'dispatch', agent: type.slice(PREFIX.length), model: typeof ti.model === 'string' ? ti.model : 'default', ...(task ? { task } : {}) };
}

/**
 * Pair dispatches with returns and total the wall-clock seconds per agent.
 * Pairs by agent_id when both lines carry one, else first-in-first-out per
 * agent; parallel runs of one agent type therefore average out rather than
 * mismatch.
 * @param {string} text contents of dispatch-log.jsonl
 * @returns {Array<{agent: string, runs: number, seconds: number, max: number}>}
 */
function summarize(text) {
  const open = {};
  const out = {};
  for (const line of text.split('\n')) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e.agent !== 'string') continue;
    if (e.event === 'dispatch') (open[e.agent] ||= []).push(Date.parse(e.ts));
    else if (e.event === 'return' && open[e.agent]?.length) {
      const sec = Math.max(0, (Date.parse(e.ts) - open[e.agent].shift()) / 1000);
      const a = (out[e.agent] ||= { agent: e.agent, runs: 0, seconds: 0, max: 0 });
      a.runs += 1; a.seconds += sec; a.max = Math.max(a.max, sec);
    }
  }
  return Object.values(out).sort((x, y) => y.seconds - x.seconds);
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

module.exports = { entryFor, record, summarize };

if (require.main === module && process.argv[2] === '--summary') {
  // node dispatch-log.js --summary [projectDir]: seconds per agent from this project's log
  try {
    const file = path.join(process.argv[3] || process.cwd(), '.eng-team', '.cache', 'dispatch-log.jsonl');
    for (const r of summarize(fs.readFileSync(file, 'utf8'))) {
      console.log(`${r.agent}\truns=${r.runs}\ttotal=${Math.round(r.seconds)}s\tmax=${Math.round(r.max)}s`);
    }
  } catch {
    // no log: nothing to report
  }
} else if (require.main === module) {
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
