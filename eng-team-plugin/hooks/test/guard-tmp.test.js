'use strict';
// Temp files: a Write aimed at /tmp or the session scratchpad is redirected into the worktree's .tmp/, not a guard stop.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { decide } = require('../guard.js');
const { stops } = require('../stops.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engtmp-')));
fs.mkdirSync(path.join(proj, '.eng-team'));
fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
fs.mkdirSync(path.join(proj, '.tmp'));
test.after(() => fs.rmSync(proj, { recursive: true, force: true }));
const call = (tool, ti, role = 'eng-builder') =>
  decide({ agent_type: `eng-team:${role}`, cwd: proj, tool_name: tool, tool_input: ti, permission_mode: 'bypassPermissions' }, { projectDir: proj });
const write = (file_path, role) => call('Write', { file_path, content: 'x' }, role);

test('a Write to tmp or the scratchpad is a redirect to .tmp/, with no guard stop', () => {
  for (const p of [path.join(os.tmpdir(), 'claude-501', 'x', 'scratchpad', 'patch.py'), '/tmp/r13t1_tail.ts']) {
    const r = write(p);
    assert.equal(r.decision, 'deny', p);
    assert.match(r.reason, /Not a hard stop.*`\.tmp\/`/, p);
    assert.doesNotMatch(r.reason, /HARD-STOP|\[S-\d+\]/, p);
  }
  assert.match(write('/tmp/x.ts', 'eng-tester').reason, /Not a hard stop/);
  assert.equal(stops(proj).length, 0);
});

test('other writes outside the project are still hard stops', () => {
  for (const p of [path.join(os.homedir(), 'notes.txt'), '/etc/x', '/tmp']) assert.match(write(p).reason, /\[S-\d+\].*HARD-STOP/, p);
});

test('.tmp/ in the worktree is writable and removable; fast-forward to the base is allowed', () => {
  assert.equal(write(path.join(proj, '.tmp', 'p.py')), null);
  assert.equal(call('Bash', { command: 'rm -r .tmp' }), null);
  assert.equal(call('Bash', { command: 'git merge --ff-only 3e5c584' }), null);
  assert.equal(call('Bash', { command: 'git reset --hard feat/run-14' }).decision, 'deny');
});
