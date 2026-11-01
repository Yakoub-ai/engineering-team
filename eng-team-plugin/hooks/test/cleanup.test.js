'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

process.env.ENG_TEAM_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'engcl-home-'));
const { branchSafe } = require('../gitref.js');
const { cleanup } = require('../../scripts/cleanup-worktrees.js');
const { enqueue, entries, reconcile, needsHumanTest } = require('../queue.js');
const { decide } = require('../guard.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engcl-')));
test.after(() => {
  for (const d of [proj, process.env.ENG_TEAM_HOME]) fs.rmSync(d, { recursive: true, force: true });
});
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
const commit = (cwd, file, text) => {
  fs.writeFileSync(path.join(cwd, file), text);
  git(cwd, 'add', file);
  git(cwd, 'commit', '-qm', file);
  return git(cwd, 'rev-parse', 'HEAD');
};
const age = (dir) => {
  const old = new Date(Date.now() - 2 * 3600_000);
  const gd = git(dir, 'rev-parse', '--absolute-git-dir');
  for (const f of [dir, path.join(gd, 'index'), path.join(gd, 'HEAD'), path.join(gd, 'logs', 'HEAD')])
    if (fs.existsSync(f)) fs.utimesSync(f, old, old);
};
const wt = (id) => path.join(proj, '.claude', 'worktrees', `agent-${id}`);
const addAgent = (id) => {
  git(proj, 'worktree', 'add', '-q', '-b', `worktree-agent-${id}`, wt(id), 'main');
  return wt(id);
};

git(proj, 'init', '-q', '-b', 'main');
fs.mkdirSync(path.join(proj, '.eng-team'));
fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
fs.writeFileSync(path.join(proj, '.gitignore'), '.claude/\nnode_modules\n');
commit(proj, 'base.txt', 'base');

test('a cherry-picked branch counts as kept; a branch with unique work does not', () => {
  const a = addAgent('pick');
  const sha = commit(a, 'pick.txt', 'pick');
  git(proj, 'cherry-pick', sha);
  assert.equal(branchSafe(proj, 'worktree-agent-pick'), true);
  assert.equal(decide({ cwd: proj, tool_name: 'Bash', tool_input: { command: 'git branch -D worktree-agent-pick' } }, { projectDir: proj })?.decision, undefined);
  const b = addAgent('own');
  commit(b, 'own.txt', 'own');
  assert.equal(branchSafe(proj, 'worktree-agent-own'), false);
});

test('cleanup removes only safe, quiet agent worktrees and their branches', () => {
  const dirty = addAgent('dirty');
  fs.writeFileSync(path.join(dirty, 'notes.txt'), 'unsaved');
  const deps = addAgent('deps');
  fs.symlinkSync(path.join(proj, 'base.txt'), path.join(deps, 'node_modules'));
  const busy = addAgent('busy');
  git(proj, 'worktree', 'lock', wt('pick'));
  for (const id of ['pick', 'own', 'dirty', 'deps']) age(wt(id));
  void busy;

  const dry = cleanup(proj, { dryRun: true });
  assert.deepEqual(dry.removed.sort(), [wt('deps'), wt('pick')].sort());
  assert.ok(fs.existsSync(wt('pick')));

  const r = cleanup(proj);
  assert.deepEqual(r.removed.sort(), [wt('deps'), wt('pick')].sort());
  const why = Object.fromEntries(r.kept.map((k) => [path.basename(k.path), k.why]));
  assert.match(why['agent-own'], /commits not on another branch/);
  assert.match(why['agent-dirty'], /untracked: notes.txt/);
  assert.match(why['agent-busy'], /last 30 minutes/);
  assert.equal(fs.existsSync(wt('pick')), false);
  const branches = git(proj, 'branch', '--list', 'worktree-agent-*');
  assert.doesNotMatch(branches, /pick|deps/);
  assert.match(branches, /own/);
});

test('the guard lets Claude run the plugin cleanup script', () => {
  const cmd = `node ${path.join(__dirname, '..', '..', 'scripts', 'cleanup-worktrees.js')} --dry-run`;
  assert.equal(decide({ cwd: proj, tool_name: 'Bash', tool_input: { command: cmd } }, { projectDir: proj }), null);
});

test('the orchestrator closes verified entries, never ones that need a human test', () => {
  const loop = "for w in $(git worktree list | grep agent- | awk '{print $1}'); do git worktree remove --force \"$w\"; done; git branch --list 'worktree-agent-*' | xargs -r git branch -D";
  const q1 = enqueue(proj, { command: loop, cwd: proj, reason: 'branch deletion' });
  const q2 = enqueue(proj, { command: 'rm -rf build && npm run deploy:prod', cwd: proj, reason: 'x' });
  assert.equal(needsHumanTest(proj, loop), false);
  assert.equal(entries(proj).find((e) => e.id === q2).needs_human_test, true);
  assert.deepEqual(reconcile(proj, Date.now(), 'agent-verified'), []); // own, dirty, busy remain
  for (const id of ['own', 'dirty', 'busy']) {
    git(proj, 'worktree', 'remove', '--force', wt(id));
    git(proj, 'branch', '-D', `worktree-agent-${id}`);
  }
  const out = spawnSync(process.execPath, [path.join(__dirname, '..', 'queue.js'), 'close', proj], { encoding: 'utf8' });
  assert.match(out.stdout, new RegExp(`Closed \\(verified\\): ${q1}`));
  assert.match(out.stdout, new RegExp(`Still open: ${q2} \\(needs human test\\)`));
  assert.equal(entries(proj).find((e) => e.id === q1).by, 'agent-verified');
});
