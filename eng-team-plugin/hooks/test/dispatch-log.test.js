'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { entryFor, record, summarize } = require('../dispatch-log.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'englog-')));
const bare = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'englog-bare-')));
fs.mkdirSync(path.join(proj, '.eng-team'));
fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
test.after(() => {
  fs.rmSync(proj, { recursive: true, force: true });
  fs.rmSync(bare, { recursive: true, force: true });
});
const logPath = (root) => path.join(root, '.eng-team', '.cache', 'dispatch-log.jsonl');
const dispatch = (type, model) => ({
  tool_name: 'Agent', cwd: proj, tool_input: { subagent_type: type, model, prompt: 'secret prompt text' },
});

test('dispatch entry has agent and model, never the prompt', () => {
  const e = entryFor(dispatch('eng-team:eng-builder', 'sonnet'), new Date('2026-10-22T08:00:00Z'));
  assert.deepEqual(e, { ts: '2026-10-22T08:00:00.000Z', event: 'dispatch', agent: 'eng-builder', model: 'sonnet' });
  assert.equal(entryFor(dispatch('eng-team:eng-builder')).model, 'default');
});

test('other agents and tools are ignored', () => {
  assert.equal(entryFor(dispatch('general-purpose', 'sonnet')), null);
  assert.equal(entryFor({ tool_name: 'Bash', tool_input: { command: 'ls' } }), null);
  assert.equal(entryFor(null), null);
  assert.equal(entryFor({ hook_event_name: 'SubagentStop', agent_type: 'other:agent' }), null);
});

test('return entry reads the terminal status', () => {
  const stop = (m) => ({ hook_event_name: 'SubagentStop', agent_type: 'eng-team:eng-tester', last_assistant_message: m });
  assert.equal(entryFor(stop('done\nStatus: DONE\nScope: T1')).status, 'DONE');
  assert.equal(entryFor(stop('HARD-STOP: eng-team guard: x')).status, 'HARD-STOP');
  assert.equal('status' in entryFor(stop('Scope reviewed: src/')), false);
});

test('writes only inside an initialised project, appends lines', () => {
  assert.equal(record(dispatch('eng-team:eng-sre', 'opus'), { projectDir: bare }), false);
  assert.equal(fs.existsSync(path.join(bare, '.eng-team')), false);
  assert.equal(record(dispatch('eng-team:eng-sre', 'opus'), { projectDir: proj }), true);
  assert.equal(record(dispatch('eng-team:eng-qa-engineer', 'sonnet'), { projectDir: proj }), true);
  const lines = fs.readFileSync(logPath(proj), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.agent), ['eng-sre', 'eng-qa-engineer']);
  assert.ok(!fs.readFileSync(logPath(proj), 'utf8').includes('secret prompt'));
});

test('stops writing past the size cap', () => {
  fs.writeFileSync(logPath(proj), 'x'.repeat(1024 * 1024 + 1));
  assert.equal(record(dispatch('eng-team:eng-sre', 'opus'), { projectDir: proj }), false);
  fs.rmSync(logPath(proj));
});

test('script: silent on malformed input, writes on valid input', () => {
  const run = (stdin) => spawnSync('node', [path.join(__dirname, '..', 'dispatch-log.js')], {
    input: stdin, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: proj },
  });
  const bad = run('not json');
  assert.equal(bad.status, 0);
  assert.equal(bad.stdout + bad.stderr, '');
  assert.equal(run(JSON.stringify(dispatch('eng-team:eng-architect', 'opus'))).status, 0);
  assert.match(fs.readFileSync(logPath(proj), 'utf8'), /eng-architect/);
});

test('task id is read from a Task: line, never the rest of the prompt', () => {
  const d = (prompt) => entryFor({ tool_name: 'Agent', tool_input: { subagent_type: 'eng-team:eng-builder', prompt } });
  assert.equal(d('Scope\nTask: T3\nsecret').task, 'T3');
  assert.equal('task' in d('Task: bad id with spaces'), false);
  assert.equal('task' in d('no marker'), false);
});

test('return keeps a well-formed agent_id only', () => {
  const stop = (agent_id) => ({ hook_event_name: 'SubagentStop', agent_type: 'eng-team:eng-builder', agent_id });
  assert.equal(entryFor(stop('a1b2')).agent_id, 'a1b2');
  assert.equal('agent_id' in entryFor(stop('bad id!')), false);
});

test('summarize pairs dispatch with the next final return, ignoring pauses', () => {
  const l = (ts, event, agent, extra = {}) => JSON.stringify({ ts, event, agent, ...extra });
  const text = [
    l('2026-10-23T10:00:00Z', 'dispatch', 'eng-builder'),
    l('2026-10-23T10:00:30Z', 'return', 'eng-builder'),
    l('2026-10-23T10:01:00Z', 'dispatch', 'eng-builder'),
    l('2026-10-23T10:01:30Z', 'return', 'eng-builder', { final: true }),
    l('2026-10-23T10:03:00Z', 'return', 'eng-builder', { final: true }),
    'garbage',
  ].join('\n');
  assert.deepEqual(summarize(text), [{ agent: 'eng-builder', runs: 2, seconds: 210, max: 120 }]);
});

test('summarize prefers harness durations and honours --since', () => {
  const l = (ts, event, extra) => JSON.stringify({ ts, event, agent: 'eng-builder', ...extra });
  const text = [
    l('2026-10-22T10:00:00Z', 'done', { duration_ms: 9000000 }),
    l('2026-10-23T10:00:00Z', 'dispatch'),
    l('2026-10-23T10:05:00Z', 'done', { duration_ms: 120000 }),
    l('2026-10-23T10:06:00Z', 'done', { duration_ms: 60000 }),
  ].join('\n');
  assert.deepEqual(summarize(text, '2026-10-23T00:00:00Z'), [{ agent: 'eng-builder', runs: 2, seconds: 180, max: 120 }]);
});

test('PostToolUse becomes a done line with duration, id and task; junk fields are dropped', () => {
  const post = (tool_response) => ({
    hook_event_name: 'PostToolUse', tool_name: 'Agent',
    tool_input: { subagent_type: 'eng-team:eng-builder', prompt: 'x\nTask: T29a' }, tool_response,
  });
  const e = entryFor(post({ totalDurationMs: 702000.4, agentId: 'a1b2', output: 'secret' }));
  assert.deepEqual({ ...e, ts: undefined }, { ts: undefined, event: 'done', agent: 'eng-builder', agent_id: 'a1b2', task: 'T29a', duration_ms: 702000 });
  const bad = entryFor(post({ totalDurationMs: 'soon', agentId: 'bad id' }));
  assert.equal('duration_ms' in bad, false);
  assert.equal('agent_id' in bad, false);
  assert.equal(entryFor({ ...post({}), tool_input: { subagent_type: 'general-purpose' } }), null);
});

test('return marks final only on the terminal line', () => {
  const stop = (m) => ({ hook_event_name: 'SubagentStop', agent_type: 'eng-team:eng-architect', last_assistant_message: m });
  assert.equal(entryFor(stop('thinking, waiting on a background task')).final, undefined);
  assert.equal(entryFor(stop('plan\nScope: whole repo')).final, true);
  assert.equal(entryFor(stop('x\nScope reviewed: src/')).final, true);
});
