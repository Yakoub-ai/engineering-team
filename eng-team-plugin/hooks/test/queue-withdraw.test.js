'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

process.env.ENG_TEAM_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'engw-home-'));
const { entries, enqueue, reconcile, withdraw, withdrawExpired, useApproval, mark } = require('../queue.js');
const { record } = require('../intent.js');

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engw-')));
const remote = path.join(tmp, 'remote.git');
const proj = path.join(tmp, 'proj');
test.after(() => {
  for (const d of [tmp, process.env.ENG_TEAM_HOME]) fs.rmSync(d, { recursive: true, force: true });
});
const g = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: proj, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
execFileSync('git', ['init', '-q', '--bare', remote]);
fs.mkdirSync(path.join(proj, '.eng-team'), { recursive: true });
fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
g('init', '-q', '-b', 'main');
g('remote', 'add', 'origin', remote);
g('commit', '-q', '--allow-empty', '-m', 'one');
const reset = () => fs.rmSync(path.join(proj, '.eng-team', 'approvals'), { recursive: true, force: true });
const status = (id) => entries(proj).find((e) => e.id === id);

test('a queued push closes itself only once git shows it landed', () => {
  reset();
  g('checkout', '-q', '-b', 'feat');
  g('commit', '-q', '--allow-empty', '-m', 'feat work');
  const id = enqueue(proj, { command: 'git push -u origin feat', cwd: proj, reason: 'git push' });
  assert.match(status(id).push.ref, /^refs\/remotes\/origin\/feat$/);
  assert.deepEqual(reconcile(proj, Date.now(), 'agent-verified'), []);
  g('push', '-q', '-u', 'origin', 'feat');
  g('commit', '-q', '--allow-empty', '-m', 'later, unpushed'); // the queued commit is what counts
  assert.deepEqual(reconcile(proj, Date.now(), 'agent-verified'), [id]);
  assert.equal(status(id).by, 'agent-verified');
});

test('bare and HEAD pushes use the target recorded when queued', () => {
  reset();
  const id = enqueue(proj, { command: 'git push', cwd: proj, reason: 'git push' });
  const head = enqueue(proj, { command: 'git push origin HEAD', cwd: proj, reason: 'git push' });
  assert.equal(status(id).push.ref, 'refs/remotes/origin/feat');
  assert.deepEqual(reconcile(proj), []);
  g('push', '-q');
  assert.deepEqual(reconcile(proj), [id, head]);
});

test('force, delete, URL and chained pushes are never verified', () => {
  reset();
  for (const c of ['git push --force origin feat', 'git push origin :feat', 'git push origin +feat', `git push ${remote} feat`, 'git push origin feat && rm -rf x', 'git push origin feat:main --no-verify'])
    enqueue(proj, { command: c, cwd: proj, reason: 'git push' });
  assert.deepEqual(reconcile(proj), []);
  assert.ok(entries(proj).every((e) => e.status === 'pending' && !e.push));
});

test('old entries without a recorded target: only a named branch is checked', () => {
  reset();
  fs.mkdirSync(path.join(proj, '.eng-team', 'approvals'), { recursive: true });
  const old = (id, command) => JSON.stringify({ id, status: 'pending', created: new Date().toISOString(), command, cwd: proj, reason: 'git push', requested_by: 'main', hash: id });
  fs.writeFileSync(path.join(proj, '.eng-team', 'approvals', 'queue.jsonl'), [old('Q-001', 'git push origin main'), old('Q-002', 'git push'), old('Q-003', 'git push origin feat')].join('\n') + '\n');
  g('push', '-q');
  assert.deepEqual(reconcile(proj), ['Q-003']); // main never pushed; bare push could have been another branch
});

test('a push to a release branch still needs the human', () => {
  reset();
  g('checkout', '-q', '-b', 'release');
  const id = enqueue(proj, { command: 'git push origin release', cwd: proj, reason: 'git push' });
  g('push', '-q', 'origin', 'release');
  assert.deepEqual(reconcile(proj, Date.now(), 'agent-verified'), []);
  assert.deepEqual(reconcile(proj), [id]); // the user's own /eng-queue
  g('checkout', '-q', 'feat');
});

test('withdraw: any open entry, with a reason; nothing runs afterwards', () => {
  reset();
  const a = enqueue(proj, { command: 'terraform destroy', cwd: proj, reason: 'terraform' });
  const b = enqueue(proj, { command: 'kubectl delete ns prod', cwd: proj, reason: 'kubectl' });
  assert.equal(status(b).needs_human_test, true);
  assert.match(withdraw(proj, a, 'short').why, /10-300/);
  assert.match(withdraw(proj, 'Q-099', 'task T3 was dropped').why, /no entry/);
  assert.equal(withdraw(proj, b, 'plan changed, T7 removed').ok, true); // withdrawing never runs anything
  assert.deepEqual([status(b).status, status(b).by, status(b).reason], ['withdrawn', 'agent', 'plan changed, T7 removed']);
  assert.match(withdraw(proj, b, 'plan changed, T7 removed').why, /already withdrawn/);
  assert.equal(mark(proj, b, 'approved'), false); // a withdrawn entry cannot be approved later
  assert.equal(mark(proj, a, 'approved'), true);
  assert.equal(withdraw(proj, a, 'superseded by T9 approach').ok, true);
  assert.equal(useApproval(proj, 'terraform destroy', proj), null); // the approval is gone
});

test('expired entries are withdrawn by the sweep and by the typed /eng-queue', () => {
  reset();
  const long = Date.now() - 100 * 3600 * 1000;
  const a = enqueue(proj, { command: 'helm uninstall x', cwd: proj, reason: 'helm' }, long);
  const b = enqueue(proj, { command: 'helm uninstall y', cwd: proj, reason: 'helm' });
  assert.deepEqual(withdrawExpired(proj), [a]);
  assert.deepEqual([status(a).status, status(a).by], ['withdrawn', 'hook-expired']);
  assert.equal(status(b).status, 'pending');
  const c = enqueue(proj, { command: 'helm uninstall z', cwd: proj, reason: 'helm' }, long);
  const out = record({ hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', session_id: 's', command_name: 'eng-team:eng-queue', command_args: '' }, Date.now(), proj);
  assert.ok(out.includes(`expired:${c}`));
});

test('CLI: close <Q-n> --withdraw "<reason>", strict arguments', () => {
  reset();
  const id = enqueue(proj, { command: 'terraform destroy', cwd: proj, reason: 'terraform' });
  const cli = (...a) => spawnSync(process.execPath, [path.join(__dirname, '..', 'queue.js'), ...a], { env: { ...process.env, CLAUDE_PROJECT_DIR: proj }, encoding: 'utf8' });
  assert.equal(cli('close', id, '--withdraw').status, 2);
  assert.equal(cli('close', id, '--withdraw', 'x', 'y').status, 2);
  assert.equal(cli('close', id, '--approve', 'task T2 dropped').status, 2);
  const r = cli('close', id, '--withdraw', 'task T2 dropped from the plan');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Withdrew Q-001/);
  assert.equal(status(id).status, 'withdrawn');
});
