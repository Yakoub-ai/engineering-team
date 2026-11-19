'use strict';
// Quoted text such as `<3>` in a test string is not a redirect; real shell writes outside the project still queue.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { decide } = require('../guard.js');

const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'engguard-ol-')));
fs.mkdirSync(path.join(proj, '.eng-team'));
fs.writeFileSync(path.join(proj, '.eng-team', 'state.md'), '# state\n');
test.after(() => fs.rmSync(proj, { recursive: true, force: true }));

const bash = (command, agent = 'eng-team:eng-builder') =>
  decide({ agent_type: agent, cwd: proj, tool_name: 'Bash', permission_mode: 'bypassPermissions', tool_input: { command } }, { projectDir: proj });

test('quoted text in code and edit commands is not a write outside the project', () => {
  for (const c of [
    "sed -i 's/<3>/♥/' src/items.test.ts && npx vitest run src/items.test.ts 2>&1 | tail -20",
    "perl -pi -e 's/<3>/heart/g' src/items.test.ts",
    'node -e "const a = 1<3, b = 2> /dev/x; console.log(a, b)"',
    "python3 -c \"s=open('t.ts').read(); open('t.ts','w').write(s.replace('<3> /x', 'heart'))\"",
    "python3 - <<'EOF'\np = 'src/a.test.ts'\ns = open(p).read().replace(\"'<3> /etc/x'\", \"'heart'\")\nopen(p, 'w').write(s)\nEOF",
    "npm test 2>&1 | tail -5; sed -i \"s|toBe('<3>/x')|toBe('♥')|\" src/a.test.ts",
  ])
    assert.equal(bash(c), null, c);
});

test('real shell writes outside the project stay queued', () => {
  for (const c of [
    'echo "<3" > /home/x',
    "bash -c 'echo hi > ~/.bashrc'",
    "sh -c \"echo x >> /etc/hosts\"",
    "python3 -c \"import os; os.system('echo x > /etc/x')\"",
    "node -e \"require('child_process').execSync('echo > /etc/x')\"",
    "perl -e 'open(F, \">/etc/x\"); print F 1'",
    "awk '{ print > \"/etc/x\" }' a.txt",
    "sed 's/a/b/e' a > /etc/x",
    "npx concurrently \"echo > /etc/x\"",
    'cat a | tee /etc/x',
  ])
    assert.match(bash(c)?.reason || '', /queued as Q-\d+/, c);
});

test('a queued outside write points builders to Edit/Write and is not a stop', () => {
  const r = bash('echo hi > /etc/motd');
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /Nothing ran/);
  assert.match(r.reason, /Edit or Write tool/);
  assert.match(r.reason, /Withdraw: Q-\d+ — made with Edit\/Write/);
  assert.match(r.reason, /HARD-STOP: needs Q-\d+/);
  assert.ok(!fs.existsSync(path.join(proj, '.eng-team', 'approvals', 'stops.jsonl')), 'no guard stop opened');
});

test('the Edit/Write route still refuses a path outside the project', () => {
  const r = decide(
    { agent_type: 'eng-team:eng-builder', cwd: proj, tool_name: 'Write', tool_input: { file_path: '/etc/motd', content: 'x' } },
    { projectDir: proj }
  );
  assert.equal(r?.decision, 'deny');
  assert.match(r.reason, /HARD-STOP/);
});

test('other queued rules keep the waiting wording', () => {
  const r = bash('curl https://example.com/x -o out');
  assert.match(r?.reason || '', /your task waits for it/);
});
