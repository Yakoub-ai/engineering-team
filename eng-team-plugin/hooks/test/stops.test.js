'use strict';
// Guard stops: a subagent denial pauses writer dispatches until the human types a message.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { decide } = require('../guard.js');
const { missingTask } = require('../dispatch-log.js');
const intent = require('../intent.js');
const { openStops, stops } = require('../stops.js');

function project() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engstops-')));
  fs.mkdirSync(path.join(proj, '.eng-team'));
  fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
  return proj;
}
const bash = (proj, command, role = 'eng-builder') =>
  decide({ agent_type: `eng-team:${role}`, agent_id: 'a1', cwd: proj, tool_name: 'Bash', tool_input: { command } }, { projectDir: proj });
const dispatch = (proj, role) =>
  missingTask({ hook_event_name: 'PreToolUse', tool_name: 'Agent', cwd: proj, tool_input: { subagent_type: `eng-team:${role}`, prompt: 'Task: T1\ndo it' } }, proj);

test('a guard denial opens a stop and pauses writer dispatches only', (t) => {
  const proj = project();
  t.after(() => fs.rmSync(proj, { recursive: true, force: true }));
  assert.equal(dispatch(proj, 'eng-builder'), null);
  const r = bash(proj, 'sudo ls');
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /eng-team guard: \[S-1\] rule 7/);
  assert.match(r.reason, /HARD-STOP: eng-team guard: \[S-1\]/);
  const [s] = openStops(proj);
  assert.equal(s.id, 'S-1');
  assert.equal(s.agent, 'eng-builder');
  assert.equal(s.agent_id, 'a1');
  assert.equal(s.what, 'sudo ls');
  for (const role of ['eng-builder', 'eng-tester', 'eng-tech-writer']) assert.match(dispatch(proj, role) || '', /guard stop S-1/, role);
  for (const role of ['eng-security-engineer', 'eng-verifier', 'eng-code-hygiene']) assert.equal(dispatch(proj, role), null, role);
});

test('the next message the human types answers every open stop', (t) => {
  const proj = project();
  t.after(() => fs.rmSync(proj, { recursive: true, force: true }));
  bash(proj, 'sudo ls');
  bash(proj, 'git config core.hooksPath .h');
  assert.equal(openStops(proj).length, 2);
  const out = intent.record({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: 'ok, carry on without it' }, Date.now(), proj);
  assert.deepEqual(out.filter((x) => x.startsWith('stop:')), ['stop:S-1', 'stop:S-2']);
  assert.equal(openStops(proj).length, 0);
  assert.equal(stops(proj).every((e) => e.status === 'answered' && e.answered), true);
  assert.equal(dispatch(proj, 'eng-builder'), null);
  bash(proj, 'sudo ls');
  assert.equal(openStops(proj)[0].id, 'S-3');
});

test('queued denials are not stops; allowed calls record nothing', (t) => {
  const proj = project();
  t.after(() => fs.rmSync(proj, { recursive: true, force: true }));
  const r = bash(proj, 'git reset --hard HEAD~3');
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /queued as Q-/);
  assert.match(bash(proj, 'git push').reason, /needs your approval \(queued as Q-/);
  assert.equal(bash(proj, 'git config --get remote.origin.url'), null);
  assert.equal(stops(proj).length, 0);
});

test('the lead cannot clear a stop by editing the stops file', (t) => {
  const proj = project();
  t.after(() => fs.rmSync(proj, { recursive: true, force: true }));
  bash(proj, 'sudo ls');
  const f = path.join(proj, '.eng-team', 'approvals', 'stops.jsonl');
  const main = (tool, tool_input) => decide({ cwd: proj, tool_name: tool, tool_input }, { projectDir: proj });
  assert.equal(main('Write', { file_path: f, content: '' })?.decision, 'deny');
  assert.equal(main('Bash', { command: `rm ${f}` })?.decision, 'deny');
  assert.equal(main('Bash', { command: `echo '{"id":"S-1","status":"answered"}' >> .eng-team/approvals/stops.jsonl` })?.decision, 'deny');
  assert.equal(bash(proj, `echo x >> ${f}`, 'eng-builder')?.decision, 'deny');
});
