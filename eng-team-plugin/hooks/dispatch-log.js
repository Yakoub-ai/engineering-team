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
  if (input.hook_event_name === 'SubagentStart') {
    const agent = input.agent_type;
    if (typeof agent !== 'string' || !agent.startsWith(PREFIX)) return null;
    const id = typeof input.agent_id === 'string' && ID_RE.test(input.agent_id) ? input.agent_id : null;
    return { ts, event: 'start', agent: agent.slice(PREFIX.length), ...(id ? { agent_id: id } : {}) };
  }
  if (input.hook_event_name === 'SubagentStop' || (input.agent_type && !input.tool_name)) {
    const agent = input.agent_type;
    if (typeof agent !== 'string' || !agent.startsWith(PREFIX)) return null;
    const msg = typeof input.last_assistant_message === 'string' ? input.last_assistant_message : '';
    const status = /^HARD-STOP:/m.test(msg) ? 'HARD-STOP' : (/^Status:\s*(DONE|BLOCKED|HARD-STOP)\b/m.exec(msg) || [])[1];
    const id = typeof input.agent_id === 'string' && ID_RE.test(input.agent_id) ? input.agent_id : null;
    // SubagentStop also fires when an agent pauses; only the terminal line marks the end of its work
    const final = /^(Status:\s*(DONE|BLOCKED|HARD-STOP)\b|Scope( reviewed)?:|HARD-STOP:)/m.test(msg);
    return { ts, event: 'return', agent: agent.slice(PREFIX.length), ...(id ? { agent_id: id } : {}), ...(status ? { status } : {}), ...(final ? { final: true } : {}) };
  }
  if (!DISPATCH_TOOLS.has(input.tool_name)) return null;
  const ti = input.tool_input || {};
  const type = ti.subagent_type;
  if (typeof type !== 'string' || !type.startsWith(PREFIX)) return null;
  if (input.hook_event_name === 'PostToolUse') {
    // the harness reports how long the dispatch took; take it from whichever field it uses, numbers only
    const r = input.tool_response && typeof input.tool_response === 'object' ? input.tool_response : {};
    const ms = [r.totalDurationMs, r.durationMs, r.duration_ms].find((v) => Number.isFinite(v) && v >= 0);
    const rid = [r.agentId, r.agent_id].find((v) => typeof v === 'string' && ID_RE.test(v));
    const task = typeof ti.prompt === 'string' ? (TASK_RE.exec(ti.prompt) || [])[1] : undefined;
    return { ts, event: 'done', agent: type.slice(PREFIX.length), ...(rid ? { agent_id: rid } : {}), ...(task ? { task } : {}), ...(ms !== undefined ? { duration_ms: Math.round(ms) } : {}) };
  }
  const task = typeof ti.prompt === 'string' ? (TASK_RE.exec(ti.prompt) || [])[1] : undefined;
  return { ts, event: 'dispatch', agent: type.slice(PREFIX.length), model: typeof ti.model === 'string' ? ti.model : 'default', ...(task ? { task } : {}) };
}

/**
 * Total the wall-clock seconds per agent, by the most exact source present:
 * 1. `start` and `return` lines sharing an agent_id: first start to last return
 *    (SubagentStop fires on every pause, so the last one ends the work);
 * 2. `done` lines with a harness duration;
 * 3. dispatches paired first-in-first-out with the next `final` return.
 * Also counts lines by event and how many carry an agent_id, so an empty or
 * odd report shows which hooks actually fired.
 * @param {string} text contents of dispatch-log.jsonl
 * @param {string} [since] ISO time; earlier lines are ignored
 * @returns {{agents: Array<{agent: string, runs: number, seconds: number, max: number}>, source: string, lines: Record<string, number>, withId: number}}
 */
function summarize(text, since) {
  const from = since ? Date.parse(since) : 0;
  const rows = [];
  const lines = {};
  let withId = 0;
  for (const line of text.split('\n')) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e.agent !== 'string' || !(Date.parse(e.ts) >= from)) continue;
    rows.push(e);
    lines[e.event] = (lines[e.event] || 0) + 1;
    if (e.agent_id) withId += 1;
  }
  const out = {};
  const add = (agent, sec) => {
    const a = (out[agent] ||= { agent, runs: 0, seconds: 0, max: 0 });
    a.runs += 1; a.seconds += sec; a.max = Math.max(a.max, sec);
  };
  const byId = {};
  for (const e of rows) {
    if (!e.agent_id) continue;
    const r = (byId[e.agent_id] ||= { agent: e.agent });
    if (e.event === 'start') r.start ??= Date.parse(e.ts);
    else if (e.event === 'return') r.stop = Date.parse(e.ts);
  }
  const paired = Object.values(byId).filter((r) => r.start !== undefined && r.stop !== undefined);
  let source = 'none';
  if (paired.length) {
    source = 'start/stop by agent_id';
    for (const r of paired) add(r.agent, Math.max(0, (r.stop - r.start) / 1000));
  } else if (rows.some((e) => e.event === 'done' && e.duration_ms !== undefined)) {
    source = 'harness duration';
    for (const e of rows) if (e.event === 'done' && e.duration_ms !== undefined) add(e.agent, e.duration_ms / 1000);
  } else {
    const open = {};
    for (const e of rows) {
      if (e.event === 'dispatch') (open[e.agent] ||= []).push(Date.parse(e.ts));
      else if (e.event === 'return' && e.final && open[e.agent]?.length) {
        source = 'dispatch/final return pairing (approximate)';
        add(e.agent, Math.max(0, (Date.parse(e.ts) - open[e.agent].shift()) / 1000));
      }
    }
  }
  return { agents: Object.values(out).sort((x, y) => y.seconds - x.seconds), source, lines, withId };
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
  // node dispatch-log.js --summary [projectDir] [--since ISO-time]: seconds per agent from this project's log
  try {
    const file = path.join(process.argv[3] || process.cwd(), '.eng-team', '.cache', 'dispatch-log.jsonl');
    const i = process.argv.indexOf('--since');
    const sm = summarize(fs.readFileSync(file, 'utf8'), i > 0 ? process.argv[i + 1] : undefined);
    for (const r of sm.agents) {
      console.log(`${r.agent}\truns=${r.runs}\ttotal=${Math.round(r.seconds)}s\tmax=${Math.round(r.max)}s`);
    }
    console.log(`source: ${sm.source}`);
    console.log(`log lines: ${JSON.stringify(sm.lines)}, with agent_id: ${sm.withId}`);
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
