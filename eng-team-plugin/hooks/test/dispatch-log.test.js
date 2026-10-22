'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { entryFor, record } = require('../dispatch-log.js');

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
