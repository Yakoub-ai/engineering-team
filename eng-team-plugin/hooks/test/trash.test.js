'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

process.env.ENG_TEAM_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'engtr-home-'));
const { trash, restore, runs, purge, projectRoot, KEEP_MS } = require('../../scripts/trash.js');
const { enqueue, entries, closeWithEvidence } = require('../queue.js');
const { decide } = require('../guard.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engtr-')));
const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engtr-out-')));
test.after(() => {
  for (const d of [proj, outside, process.env.ENG_TEAM_HOME]) fs.rmSync(d, { recursive: true, force: true });
});
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
const put = (rel, text = 'x') => {
  fs.mkdirSync(path.dirname(path.join(proj, rel)), { recursive: true });
  fs.writeFileSync(path.join(proj, rel), text);
};
const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'trash.js');

git(proj, 'init', '-q', '-b', 'main');
put('.eng-team/state.md', '# state\n');
put('old/a.txt', 'a');
put('old/deep/b.txt', 'b');
git(proj, 'add', '.');
git(proj, 'commit', '-qm', 'base');
put('scratch.log', 'untracked');
put('.env', 'SECRET=1');
fs.writeFileSync(path.join(outside, 'keep.txt'), 'outside');
fs.symlinkSync(outside, path.join(proj, 'link-out'));

test('moves old files (tracked or not) to the trash and restores them', () => {
  assert.equal(projectRoot(path.join(proj, 'old')), proj);
  const r = trash(proj, proj, ['old', 'scratch.log']);
  assert.deepEqual(r.refused, []);
  assert.deepEqual(r.moved.sort(), ['old', 'scratch.log']);
  assert.equal(fs.existsSync(path.join(proj, 'old')), false);
  assert.equal(fs.existsSync(path.join(proj, 'scratch.log')), false);
  const [run] = runs(proj);
  assert.equal(run.id, r.run);
  assert.equal(fs.readFileSync(path.join(run.dir, 'files', 'old', 'deep', 'b.txt'), 'utf8'), 'b');
  assert.ok(!run.dir.startsWith(proj + path.sep), 'trash lives outside the project');
  put('scratch.log', 'new');
  assert.match(restore(proj, r.run).why, /would overwrite: scratch.log/);
  fs.rmSync(path.join(proj, 'scratch.log'));
  assert.equal(restore(proj, r.run).ok, true);
  assert.equal(fs.readFileSync(path.join(proj, 'old', 'a.txt'), 'utf8'), 'a');
  assert.equal(fs.readFileSync(path.join(proj, 'scratch.log'), 'utf8'), 'untracked');
  assert.equal(runs(proj).length, 0);
});

test('refuses dangerous paths, and moves nothing if any path is refused', () => {
  const nested = path.join(proj, 'vendor-repo');
  fs.mkdirSync(nested);
  git(nested, 'init', '-q');
  put('.claude/settings.json', '{}');
  put('.claude/worktrees/agent-x/f.txt');
  const cases = {
    [outside]: /outside the project/, '.': /outside the project, or the project itself/, '..': /outside/,
    '.git': /never trashed/, '.git/config': /never trashed/, '.eng-team': /never trashed/, '.eng-team/state.md': /never trashed/,
    '.claude/settings.json': /protected/, '.claude/worktrees/agent-x': /cleanup-worktrees/, 'vendor-repo': /git repository/,
    'missing.txt': /does not exist/, 'link-out/keep.txt': /outside the project/,
  };
  for (const [p, why] of Object.entries(cases)) {
    const r = trash(proj, proj, ['old', p]);
    assert.equal(r.run, null, p);
    assert.match(r.refused.map((x) => x.why).join(';'), why, p);
    assert.ok(fs.existsSync(path.join(proj, 'old')), `nothing moved for ${p}`);
  }
  assert.match(trash(proj, proj, ['old', 'old/a.txt']).refused[0].why, /listed too/);
});

test('a symlink is moved as a link; its target is untouched', () => {
  const r = trash(proj, proj, ['link-out']);
  assert.deepEqual(r.refused, []);
  assert.equal(fs.existsSync(path.join(proj, 'link-out')), false);
  assert.equal(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8'), 'outside');
  assert.equal(restore(proj, r.run).ok, true);
  assert.ok(fs.lstatSync(path.join(proj, 'link-out')).isSymbolicLink());
});

test('dry run moves nothing; runs older than 14 days are purged', () => {
  const d = trash(proj, proj, ['.env'], { dryRun: true });
  assert.deepEqual([d.run, d.moved], [null, ['.env']]);
  assert.ok(fs.existsSync(path.join(proj, '.env')));
  const r = trash(proj, proj, ['.env']);
  assert.deepEqual(purge(proj, Date.now() + KEEP_MS - 60_000), []);
  assert.deepEqual(purge(proj, Date.now() + KEEP_MS + 60_000), [r.run]);
  assert.equal(runs(proj).length, 0);
});

test('CLI: refuses with a non-zero exit and moves nothing', () => {
  const out = spawnSync(process.execPath, [SCRIPT, 'old', '.git'], { cwd: proj, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: proj } });
  assert.equal(out.status, 1);
  assert.match(out.stdout, /Nothing moved\. Refused:\n {2}\.git — \.git\/ is never trashed/);
  const ok = spawnSync(process.execPath, [SCRIPT, 'old/deep'], { cwd: proj, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: proj } });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /Moved 1 path\(s\) to the trash \(run \d{8}T\d{6}Z-[0-9a-f]{6}, kept 14 days/);
});

test('guard: the lead may run trash and cleanup scripts; subagents may not', () => {
  const lead = (command) => decide({ cwd: proj, tool_name: 'Bash', tool_input: { command } }, { projectDir: proj });
  const agent = (command) => decide({ cwd: proj, tool_name: 'Bash', agent_type: 'eng-team:eng-builder', tool_input: { command } }, { projectDir: proj });
  for (const c of [`node ${SCRIPT} old`, `node ${SCRIPT} --restore 20261101T000000Z-abcdef`, 'node /p/hooks/queue.js close Q-1 --evidence "file is gone now"', 'node /p/scripts/cleanup-worktrees.js']) {
    assert.equal(lead(c), null, c);
    assert.equal(agent(c)?.decision, 'deny', c);
    assert.match(agent(c).reason, /lead only/, c);
  }
  const rm = lead('rm -rf old');
  assert.equal(rm.decision, 'deny');
  assert.match(rm.reason, /recoverable trash .*scripts\/trash\.js <path>/);
});

test('queue: the lead closes a checked entry with evidence, never one that needs a human test', () => {
  const a = enqueue(proj, { command: 'rm -rf old', cwd: proj, reason: 'recursive rm of project files (old)' });
  const b = enqueue(proj, { command: 'npm run deploy:prod', cwd: proj, reason: 'deploy' });
  assert.match(closeWithEvidence(proj, a, 'short').why, /10-300/);
  assert.deepEqual(closeWithEvidence(proj, a, 'old/ moved to trash run X; ls shows it gone'), { ok: true });
  const e = entries(proj).find((x) => x.id === a);
  assert.deepEqual([e.status, e.by, e.evidence], ['done', 'agent-evidence', 'old/ moved to trash run X; ls shows it gone']);
  assert.match(closeWithEvidence(proj, a, 'closing it a second time').why, /already done/);
  assert.match(closeWithEvidence(proj, b, 'the deploy looked fine to me').why, /needs a human test/);
  assert.equal(entries(proj).find((x) => x.id === b).status, 'pending');
  const cli = spawnSync(process.execPath, [path.join(__dirname, '..', 'queue.js'), 'close', b, '--evidence', 'the deploy looked fine'], {
    encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: proj },
  });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /Not closed: .*needs a human test/);
});
