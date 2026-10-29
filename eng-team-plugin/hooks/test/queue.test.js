'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.ENG_TEAM_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'engq-home-'));
const { entries, enqueue, mark } = require('../queue.js');
const { record } = require('../intent.js');
const { decide } = require('../guard.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engq-')));
fs.mkdirSync(path.join(proj, '.eng-team'));
fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engq-plain-')));
test.after(() => {
  for (const d of [proj, plain, process.env.ENG_TEAM_HOME]) fs.rmSync(d, { recursive: true, force: true });
});
const reset = () => fs.rmSync(path.join(proj, '.eng-team', 'approvals'), { recursive: true, force: true });
const typed = (args) =>
  record({ hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', session_id: 's', command_name: 'eng-team:eng-queue', command_args: args }, Date.now(), proj);

test('a denied destructive command is queued once, with its exact command', () => {
  reset();
  const main = (command) => decide({ cwd: proj, tool_name: 'Bash', tool_input: { command } }, { projectDir: proj });
  const r = main('terraform destroy -auto-approve');
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /Queued as Q-001: pause only the work that needs it/);
  assert.match(main('terraform destroy -auto-approve').reason, /Queued as Q-001/);
  assert.match(main('git push --force').reason, /Queued as Q-002/);
  const e = entries(proj);
  assert.equal(e.length, 2);
  assert.deepEqual([e[0].command, e[0].status, e[0].requested_by], ['terraform destroy -auto-approve', 'pending', 'main']);
  assert.match(e[0].hash, /^[0-9a-f]{64}$/);
});

test('subagent denials are queued and name the queue id', () => {
  reset();
  const r = decide({ agent_type: 'eng-team:eng-builder', cwd: proj, tool_name: 'Bash', tool_input: { command: 'databricks bundle destroy' } }, { projectDir: proj });
  assert.match(r.reason, /queued as Q-001; your task waits for it/);
  assert.equal(entries(proj)[0].requested_by, 'eng-team:eng-builder');
});

test('protected-file denials and non-eng-team projects are not queued', () => {
  reset();
  decide({ cwd: proj, tool_name: 'Bash', tool_input: { command: 'echo {} > .claude/settings.json' } }, { projectDir: proj });
  assert.equal(entries(proj).length, 0);
  decide({ agent_type: 'eng-team:eng-builder', cwd: plain, tool_name: 'Bash', tool_input: { command: 'git push --force' } }, { projectDir: plain });
  assert.equal(fs.existsSync(path.join(plain, '.eng-team')), false);
});

test('only the human-typed command marks entries', () => {
  reset();
  enqueue(proj, { command: 'az group delete -n x', reason: 'cloud delete' });
  enqueue(proj, { command: 'git reset --hard', reason: 'git reset --hard' });
  assert.deepEqual(typed('done Q-001'), ['queue:Q-001']);
  assert.deepEqual(typed('reject q-002'), ['queue:Q-002']);
  assert.deepEqual(typed('done Q-001'), []);
  assert.deepEqual(typed('done Q-009'), []);
  assert.deepEqual(typed('list'), []);
  assert.deepEqual(entries(proj).map((e) => e.status), ['done', 'rejected']);
  // Claude invoking the skill is a PreToolUse Skill call, not an expansion: nothing marks.
  enqueue(proj, { command: 'gh repo delete x', reason: 'repo deletion' });
  record({ hook_event_name: 'UserPromptSubmit', command_name: 'eng-team:eng-queue', command_args: 'done Q-003' }, Date.now(), proj);
  assert.equal(entries(proj)[2].status, 'pending');
});

test('Claude cannot write the queue', () => {
  const q = path.join(proj, '.eng-team', 'approvals', 'queue.jsonl');
  assert.equal(decide({ cwd: proj, tool_name: 'Edit', tool_input: { file_path: q, old_string: 'pending', new_string: 'done' } }, { projectDir: proj })?.decision, 'deny');
  assert.equal(decide({ cwd: proj, tool_name: 'Bash', tool_input: { command: `echo '{"id":"Q-003","status":"done"}' >> .eng-team/approvals/queue.jsonl` } }, { projectDir: proj })?.decision, 'deny');
});

test('pending entries expire after approval_ttl_hours and can still be marked', () => {
  reset();
  const old = Date.now() - 25 * 3600 * 1000;
  enqueue(proj, { command: 'pulumi destroy', reason: 'pulumi' }, old);
  assert.equal(entries(proj)[0].status, 'expired');
  assert.equal(enqueue(proj, { command: 'pulumi destroy', reason: 'pulumi' }), 'Q-002');
  assert.equal(mark(proj, 'Q-001', 'done'), true);
  assert.equal(mark(proj, 'Q-002', 'approved'), false);
});
