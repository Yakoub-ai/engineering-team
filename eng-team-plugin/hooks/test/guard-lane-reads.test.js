'use strict';
// Lane checks look at write targets: reading lead-owned files from the shell passes, writing them is a redirect, not a stop.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { decide } = require('../guard.js');
const { missingTask } = require('../dispatch-log.js');
const { stops } = require('../stops.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'englane-')));
fs.mkdirSync(path.join(proj, '.eng-team'));
fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
test.after(() => fs.rmSync(proj, { recursive: true, force: true }));
const bash = (command, role = 'eng-builder') =>
  decide({ agent_type: `eng-team:${role}`, cwd: proj, tool_name: 'Bash', tool_input: { command } }, { projectDir: proj });

test('reading lead-owned files from the shell passes', () => {
  for (const c of [
    "sed -e 's/<[^>]*>//g' docs/engineering/specs/d/slides/01.html | grep -v '^$'",
    "grep -o '<h1>[^<]*' docs/engineering/specs/d/slides/*.html",
    'for f in docs/engineering/s/*.html; do echo $f; sed -n 1,5p $f; done',
    'cat docs/engineering/a.html > presentation/src/a.html',
    'cp docs/engineering/a.html presentation/src/',
    "sed -n '/word/p' docs/engineering/a",
    'git log -- docs/engineering',
    'cat .eng-team/state.md',
  ])
    assert.equal(bash(c), null, c);
});

test('writes into the lane are still denied, including through sed w, cd, variables and xargs', () => {
  for (const c of [
    'echo x > docs/engineering/a',
    'echo x >> .eng-team/state.md',
    'cd docs/engineering && echo x > a',
    'for f in docs/engineering/*; do sed -i s/a/b/ $f; done',
    "sed 's/a/b/w docs/engineering/x' src/a",
    "sed -n 'w docs/engineering/x' src/a",
    'sed -i s/a/b/ docs/engineering/x',
    'cp src/a docs/engineering/',
    'cp -t docs/engineering src/a',
    'mv docs/engineering/a src/',
    'python3 x.py docs/engineering/a',
    'cat src/a | tee docs/engineering/b',
    `awk '{print > "docs/engineering/x"}' src/a`,
    'git checkout -- docs/engineering/x',
    'xargs rm < docs/engineering/list',
    'grep -l x docs/engineering/* | xargs sed -i s/a/b/',
    'echo x > docs/README.md',
  ])
    assert.equal(bash(c)?.decision, 'deny', c);
});

test('a lane denial is a redirect: no guard stop, builders keep running', () => {
  const r = bash('echo x > docs/engineering/a');
  assert.match(r.reason, /rule 5 .*Not a hard stop/);
  assert.doesNotMatch(r.reason, /HARD-STOP/);
  const w = decide({ agent_type: 'eng-team:eng-security-engineer', cwd: proj, tool_name: 'Write', tool_input: { file_path: path.join(proj, 'src/a'), content: 'x' } }, { projectDir: proj });
  assert.match(w.reason, /read-only .*Not a hard stop/);
  assert.equal(stops(proj).length, 0);
  const d = missingTask({ hook_event_name: 'PreToolUse', tool_name: 'Agent', cwd: proj, tool_input: { subagent_type: 'eng-team:eng-builder', prompt: 'Task: T2' } }, proj);
  assert.equal(d, null);
});

test('red flags and destructive lane commands are not redirects', () => {
  assert.match(bash('sudo cat docs/engineering/a').reason, /\[S-\d+\].*HARD-STOP/);
  assert.match(bash('git checkout -- docs/engineering/x').reason, /destructive.*queued as Q-/);
  assert.match(bash('echo x > .eng-team/policy.json').reason, /HARD-STOP/);
});
