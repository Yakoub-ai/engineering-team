'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

process.env.ENG_TEAM_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'enggr-home-'));
const { losslessBranchDelete, branchGone } = require('../gitref.js');
const { entries } = require('../queue.js');
const { record } = require('../intent.js');
const { decide } = require('../guard.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'enggr-')));
test.after(() => {
  for (const d of [proj, process.env.ENG_TEAM_HOME]) fs.rmSync(d, { recursive: true, force: true });
});
const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: proj, stdio: 'pipe' });
git('init', '-q', '-b', 'main');
fs.mkdirSync(path.join(proj, '.eng-team'));
fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
git('add', '.');
git('commit', '-qm', 'init');
git('branch', 'merged');           // same tip as main: lossless
git('checkout', '-qb', 'work');    // one commit only on this branch
fs.writeFileSync(path.join(proj, 'a.txt'), 'a');
git('add', 'a.txt');
git('commit', '-qm', 'work');
git('checkout', '-q', 'main');

const main = (command) => decide({ cwd: proj, tool_name: 'Bash', tool_input: { command } }, { projectDir: proj });
const sub = (command) => decide({ agent_type: 'eng-team:eng-builder', cwd: proj, tool_name: 'Bash', tool_input: { command } }, { projectDir: proj });

test('a branch whose commits are on another branch may be deleted', () => {
  assert.equal(losslessBranchDelete('git branch -D merged', proj), true);
  assert.equal(main('git branch -D merged'), null);
  assert.equal(main('git branch -d merged'), null);
  assert.equal(sub('git branch --delete --force merged'), null);
});

test('unmerged, current, default, missing or non-literal deletes stay blocked', () => {
  for (const c of ['git branch -D work', 'git branch -D main', 'git branch -D nope', 'git branch -D merged work', 'git branch -D merged; rm -rf x',
    'git branch -D $B', 'git branch -D "merged"', 'git -C /tmp branch -D merged', 'cd /tmp && git branch -D merged', 'git branch -D -- merged'])
    assert.equal(main(c)?.decision, 'deny', c);
  git('checkout', '-q', 'merged');
  assert.equal(main('git branch -D merged')?.decision, 'deny');
  git('checkout', '-q', 'main');
});

test('a queued branch delete closes itself once the branch is gone', () => {
  assert.match(main('git branch -D work').reason, /Q-001/);
  assert.equal(branchGone('git branch -D work', proj), false);
  git('branch', '-D', 'work');
  assert.equal(branchGone('git branch -D work', proj), true);
  assert.equal(branchGone('git branch -D work', path.join(proj, 'missing')), false);
  record({ hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', session_id: 's', command_name: 'eng-team:eng-queue', command_args: '' }, Date.now(), proj);
  const e = entries(proj).find((x) => x.id === 'Q-001');
  assert.equal(e.status, 'done');
});
