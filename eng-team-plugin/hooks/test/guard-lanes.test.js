'use strict';
// Lanes for subagents: agent worktrees, .git internals, shell writes into lead-owned paths, the viewer API.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { decide } = require('../guard.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engguard-l-')));
const wt = path.join(proj, '.claude', 'worktrees', 'agent-a1');
for (const d of ['.eng-team', 'src', 'docs/engineering', path.join(wt, 'src'), path.join(wt, '.eng-team')])
  fs.mkdirSync(path.isAbsolute(d) ? d : path.join(proj, d), { recursive: true });
fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
fs.writeFileSync(path.join(wt, '.git'), 'gitdir: ../../../.git/worktrees/agent-a1\n');
test.after(() => fs.rmSync(proj, { recursive: true, force: true }));

const run = (role, tool, tool_input, cwd = proj) =>
  decide({ agent_type: `eng-team:${role}`, cwd, tool_name: tool, tool_input }, { projectDir: proj });
const write = (role, file, cwd) => run(role, 'Write', { file_path: file, content: 'x' }, cwd);
const bash = (command, role = 'eng-builder') => run(role, 'Bash', { command });

const LEAD_FILES = ['.eng-team/state.md', '.eng-team/policy.json', 'docs/engineering/STATUS.md', '.claude/settings.json', 'docs/README.md', 'docs/compliance/x.md'];

test('worktree copies of lead-owned, protected and reader-doc paths are denied like the main checkout', () => {
  for (const f of LEAD_FILES) {
    assert.equal(write('eng-builder', path.join(proj, f))?.decision, 'deny', `main ${f}`);
    assert.equal(write('eng-builder', path.join(wt, f), wt)?.decision, 'deny', `worktree ${f}`);
    assert.equal(write('eng-builder', f, wt)?.decision, 'deny', `worktree relative ${f}`);
  }
});

test('worktree prefix is recognised even before the worktree .git file exists', () => {
  const fresh = path.join(proj, '.claude', 'worktrees', 'agent-new');
  assert.equal(write('eng-tester', path.join(fresh, '.eng-team', 'state.md'))?.decision, 'deny');
});

test('normal source writes in a worktree still pass', () => {
  assert.equal(write('eng-builder', path.join(wt, 'src', 'a.js'), wt), null);
  assert.equal(write('eng-tester', 'src/a.test.js', wt), null);
});

test('subagent shell may not touch .git internals or set git config that runs programs', () => {
  for (const c of [
    'echo x > .git/hooks/pre-commit', 'chmod +x .git/hooks/post-checkout', 'cp hook.sh .git/hooks/pre-commit',
    'git config core.hooksPath tools/hooks', 'git config core.fsmonitor ./x.sh', 'git -C . config --local core.fsMonitor x',
    'git config alias.st "!sh x.sh"', 'git config filter.lfs.smudge x', 'git config --global user.name x',
    'git config include.path ../evil', 'node -e "fs.writeFileSync(\'.git/config\', s)"',
  ])
    assert.equal(bash(c)?.decision, 'deny', c);
  for (const c of ['git status', 'git log --oneline', 'cat .git/HEAD', 'git config user.email a@b.c', 'git commit -m "x"'])
    assert.equal(bash(c), null, c);
});

test('rule 5 holds for the shell: no writes into .eng-team, docs/engineering or reader docs', () => {
  for (const c of [
    'sed -i s/open/passed/ .eng-team/state.md', 'echo hi >> docs/engineering/STATUS.md', "python3 -c \"open('.eng-team/state.md','w')\"",
    'cp x .claude/worktrees/agent-a1/.eng-team/state.md', 'echo x > docs/README.md', 'touch docs/compliance/gdpr.md',
  ])
    for (const role of ['eng-builder', 'eng-tester']) assert.equal(bash(c, role)?.decision, 'deny', `${role}: ${c}`);
  for (const c of ['cat .eng-team/state.md', 'ls .eng-team', 'grep -r foo docs/engineering', 'npm test', 'echo ok > src/a.txt'])
    assert.equal(bash(c), null, c);
});

test('subagents may not call the eng-view write API', () => {
  const c = 'curl -X PUT -H "X-Eng-View: 1" "http://127.0.0.1:4777/api/doc?path=.eng-team/profile.md" --data @p.json';
  assert.equal(bash(c)?.decision, 'deny');
  assert.equal(bash('curl -s http://127.0.0.1:3000/health'), null);
});
